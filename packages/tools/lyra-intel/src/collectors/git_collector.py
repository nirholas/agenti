"""
Git Collector - Extracts comprehensive git history and metadata.

Designed for massive scale:
- Parallel commit processing
- Streaming for large histories
- Blame analysis
- Branch/tag tracking
"""

import asyncio
import subprocess
import json
from pathlib import Path
from typing import Dict, List, Any, Optional, AsyncIterator
from dataclasses import dataclass, field
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


@dataclass
class CommitInfo:
    """Information about a git commit."""
    hash: str
    short_hash: str
    author_name: str
    author_email: str
    author_date: datetime
    committer_name: str
    committer_email: str
    commit_date: datetime
    subject: str
    body: str
    files_changed: int
    insertions: int
    deletions: int
    parent_hashes: List[str]
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "hash": self.hash,
            "short_hash": self.short_hash,
            "author_name": self.author_name,
            "author_email": self.author_email,
            "author_date": self.author_date.isoformat(),
            "committer_name": self.committer_name,
            "committer_email": self.committer_email,
            "commit_date": self.commit_date.isoformat(),
            "subject": self.subject,
            "body": self.body,
            "files_changed": self.files_changed,
            "insertions": self.insertions,
            "deletions": self.deletions,
            "parent_hashes": self.parent_hashes,
        }


@dataclass
class FileChange:
    """Information about a file change in a commit."""
    commit_hash: str
    file_path: str
    change_type: str  # A, M, D, R, C
    old_path: Optional[str]
    insertions: int
    deletions: int


@dataclass 
class BlameInfo:
    """Blame information for a line."""
    line_number: int
    commit_hash: str
    author: str
    date: datetime
    content: str


@dataclass
class GitCollectorConfig:
    """Configuration for git collector."""
    max_workers: int = 8
    batch_size: int = 500
    include_file_changes: bool = True
    include_diff_stats: bool = True
    follow_renames: bool = True
    max_commits: Optional[int] = None  # None = all commits


class GitCollector:
    """
    Asynchronous git repository collector.
    
    Features:
    - Full commit history extraction
    - File change tracking
    - Blame analysis
    - Branch and tag information
    - Contributor statistics
    """
    
    def __init__(self, config: Optional[GitCollectorConfig] = None):
        self.config = config or GitCollectorConfig()
        self._semaphore = asyncio.Semaphore(self.config.max_workers)
        
    async def _run_git(self, repo_path: str, args: List[str]) -> str:
        """Run a git command asynchronously."""
        cmd = ["git", "-C", repo_path] + args
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        
        stdout, stderr = await process.communicate()
        
        if process.returncode != 0:
            logger.error(f"Git command failed: {stderr.decode()}")
            raise RuntimeError(f"Git command failed: {' '.join(cmd)}")
            
        return stdout.decode("utf-8", errors="replace")
    
    async def get_commits(self, repo_path: str) -> AsyncIterator[List[CommitInfo]]:
        """
        Stream commit history in batches.
        
        Args:
            repo_path: Path to git repository
            
        Yields:
            Batches of CommitInfo objects
        """
        # Custom format for parsing
        format_str = "%H|%h|%an|%ae|%at|%cn|%ce|%ct|%s|%b|%P"
        separator = "---COMMIT_END---"
        
        args = [
            "log",
            "--all",
            f"--format={format_str}{separator}",
            "--numstat",
        ]
        
        if self.config.max_commits:
            args.append(f"-n{self.config.max_commits}")
            
        output = await self._run_git(repo_path, args)
        
        batch = []
        current_commit = None
        files_changed = 0
        insertions = 0
        deletions = 0
        
        for line in output.split("\n"):
            if separator in line:
                # Parse commit line
                commit_part = line.replace(separator, "")
                if commit_part:
                    parts = commit_part.split("|")
                    if len(parts) >= 11:
                        if current_commit:
                            current_commit.files_changed = files_changed
                            current_commit.insertions = insertions
                            current_commit.deletions = deletions
                            batch.append(current_commit)
                            
                            if len(batch) >= self.config.batch_size:
                                yield batch
                                batch = []
                        
                        current_commit = CommitInfo(
                            hash=parts[0],
                            short_hash=parts[1],
                            author_name=parts[2],
                            author_email=parts[3],
                            author_date=datetime.fromtimestamp(int(parts[4])),
                            committer_name=parts[5],
                            committer_email=parts[6],
                            commit_date=datetime.fromtimestamp(int(parts[7])),
                            subject=parts[8],
                            body=parts[9],
                            files_changed=0,
                            insertions=0,
                            deletions=0,
                            parent_hashes=parts[10].split() if parts[10] else [],
                        )
                        files_changed = 0
                        insertions = 0
                        deletions = 0
                        
            elif line and current_commit and "\t" in line:
                # Parse numstat line
                parts = line.split("\t")
                if len(parts) >= 2:
                    try:
                        ins = int(parts[0]) if parts[0] != "-" else 0
                        dels = int(parts[1]) if parts[1] != "-" else 0
                        insertions += ins
                        deletions += dels
                        files_changed += 1
                    except ValueError:
                        pass
        
        # Add last commit
        if current_commit:
            current_commit.files_changed = files_changed
            current_commit.insertions = insertions
            current_commit.deletions = deletions
            batch.append(current_commit)
            
        if batch:
            yield batch
    
    async def get_all_commits(self, repo_path: str) -> List[CommitInfo]:
        """Get all commits (non-streaming)."""
        all_commits = []
        async for batch in self.get_commits(repo_path):
            all_commits.extend(batch)
        return all_commits
    
    async def get_file_changes(self, repo_path: str, commit_hash: str) -> List[FileChange]:
        """Get file changes for a specific commit."""
        args = ["show", "--numstat", "--format=", commit_hash]
        output = await self._run_git(repo_path, args)
        
        changes = []
        for line in output.strip().split("\n"):
            if line and "\t" in line:
                parts = line.split("\t")
                if len(parts) >= 3:
                    insertions = int(parts[0]) if parts[0] != "-" else 0
                    deletions = int(parts[1]) if parts[1] != "-" else 0
                    file_path = parts[2]
                    
                    changes.append(FileChange(
                        commit_hash=commit_hash,
                        file_path=file_path,
                        change_type="M",  # Would need diff-tree for accurate type
                        old_path=None,
                        insertions=insertions,
                        deletions=deletions,
                    ))
                    
        return changes
    
    async def get_branches(self, repo_path: str) -> List[Dict[str, Any]]:
        """Get all branches."""
        output = await self._run_git(repo_path, ["branch", "-a", "--format=%(refname:short)|%(objectname:short)|%(upstream:short)"])
        
        branches = []
        for line in output.strip().split("\n"):
            if line:
                parts = line.split("|")
                branches.append({
                    "name": parts[0],
                    "commit": parts[1] if len(parts) > 1 else "",
                    "upstream": parts[2] if len(parts) > 2 else "",
                })
                
        return branches
    
    async def get_tags(self, repo_path: str) -> List[Dict[str, Any]]:
        """Get all tags."""
        output = await self._run_git(repo_path, ["tag", "-l", "--format=%(refname:short)|%(objectname:short)|%(creatordate:iso)"])
        
        tags = []
        for line in output.strip().split("\n"):
            if line:
                parts = line.split("|")
                tags.append({
                    "name": parts[0],
                    "commit": parts[1] if len(parts) > 1 else "",
                    "date": parts[2] if len(parts) > 2 else "",
                })
                
        return tags
    
    async def get_contributors(self, repo_path: str) -> List[Dict[str, Any]]:
        """Get contributor statistics."""
        output = await self._run_git(repo_path, ["shortlog", "-sne", "--all"])
        
        contributors = []
        for line in output.strip().split("\n"):
            if line:
                # Format: "  123\tAuthor Name <email>"
                parts = line.strip().split("\t")
                if len(parts) >= 2:
                    count = int(parts[0].strip())
                    author = parts[1]
                    
                    # Parse email
                    name = author
                    email = ""
                    if "<" in author and ">" in author:
                        name = author[:author.index("<")].strip()
                        email = author[author.index("<")+1:author.index(">")]
                        
                    contributors.append({
                        "name": name,
                        "email": email,
                        "commit_count": count,
                    })
                    
        return contributors
    
    async def get_blame(self, repo_path: str, file_path: str) -> List[BlameInfo]:
        """Get blame information for a file."""
        async with self._semaphore:
            try:
                args = ["blame", "--line-porcelain", file_path]
                output = await self._run_git(repo_path, args)
                
                blame_info = []
                current_hash = ""
                current_author = ""
                current_date = None
                line_number = 0
                
                for line in output.split("\n"):
                    if line.startswith("author "):
                        current_author = line[7:]
                    elif line.startswith("author-time "):
                        current_date = datetime.fromtimestamp(int(line[12:]))
                    elif line and line[0].isalnum() and len(line.split()[0]) == 40:
                        parts = line.split()
                        current_hash = parts[0]
                        line_number = int(parts[2]) if len(parts) > 2 else line_number + 1
                    elif line.startswith("\t"):
                        blame_info.append(BlameInfo(
                            line_number=line_number,
                            commit_hash=current_hash,
                            author=current_author,
                            date=current_date or datetime.now(),
                            content=line[1:],
                        ))
                        
                return blame_info
                
            except Exception as e:
                logger.error(f"Blame failed for {file_path}: {e}")
                return []
    
    async def get_stats(self, commits: List[CommitInfo]) -> Dict[str, Any]:
        """Generate statistics from commits."""
        if not commits:
            return {}
            
        total_insertions = sum(c.insertions for c in commits)
        total_deletions = sum(c.deletions for c in commits)
        total_files = sum(c.files_changed for c in commits)
        
        # Author stats
        author_commits = {}
        for c in commits:
            author_commits[c.author_email] = author_commits.get(c.author_email, 0) + 1
        
        return {
            "total_commits": len(commits),
            "total_insertions": total_insertions,
            "total_deletions": total_deletions,
            "total_files_changed": total_files,
            "unique_authors": len(author_commits),
            "date_range": {
                "earliest": min(c.commit_date for c in commits).isoformat(),
                "latest": max(c.commit_date for c in commits).isoformat(),
            },
            "top_authors": sorted(
                [{"email": k, "commits": v} for k, v in author_commits.items()],
                key=lambda x: x["commits"],
                reverse=True
            )[:10],
        }
