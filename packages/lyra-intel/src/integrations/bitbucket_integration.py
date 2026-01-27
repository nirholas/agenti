"""
Bitbucket integration for Lyra Intel.
"""

import requests
from typing import Dict, Any, List, Optional
import logging
from base64 import b64encode

logger = logging.getLogger(__name__)


class BitbucketIntegration:
    """Integration with Bitbucket for PR comments and issue creation."""
    
    def __init__(self, workspace: str, repo_slug: str, username: str, app_password: str):
        self.workspace = workspace
        self.repo_slug = repo_slug
        self.base_url = "https://api.bitbucket.org/2.0"
        
        # Create basic auth header
        credentials = f"{username}:{app_password}"
        encoded = b64encode(credentials.encode()).decode()
        self.headers = {
            "Authorization": f"Basic {encoded}",
            "Content-Type": "application/json"
        }
    
    def create_issue(self, title: str, content: str, kind: str = "bug", 
                     priority: str = "major") -> Dict[str, Any]:
        """Create an issue in Bitbucket."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/issues"
        
        data = {
            "title": title,
            "content": {"raw": content},
            "kind": kind,  # bug, enhancement, proposal, task
            "priority": priority  # trivial, minor, major, critical, blocker
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create Bitbucket issue: {e}")
            raise
    
    def comment_on_pull_request(self, pr_id: int, comment: str, 
                                 inline: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Add a comment to a pull request."""
        if inline:
            return self._add_inline_comment(pr_id, comment, inline)
        else:
            return self._add_pr_comment(pr_id, comment)
    
    def _add_pr_comment(self, pr_id: int, comment: str) -> Dict[str, Any]:
        """Add a general comment to a PR."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/pullrequests/{pr_id}/comments"
        
        data = {
            "content": {"raw": comment}
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to add PR comment: {e}")
            raise
    
    def _add_inline_comment(self, pr_id: int, comment: str, 
                           inline: Dict[str, Any]) -> Dict[str, Any]:
        """Add an inline comment to a PR."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/pullrequests/{pr_id}/comments"
        
        data = {
            "content": {"raw": comment},
            "inline": {
                "to": inline.get("line"),
                "path": inline.get("path")
            }
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to add inline comment: {e}")
            raise
    
    def get_pull_request(self, pr_id: int) -> Dict[str, Any]:
        """Get pull request details."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/pullrequests/{pr_id}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get pull request: {e}")
            raise
    
    def approve_pull_request(self, pr_id: int) -> Dict[str, Any]:
        """Approve a pull request."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/pullrequests/{pr_id}/approve"
        
        try:
            response = requests.post(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to approve PR: {e}")
            raise
    
    def unapprove_pull_request(self, pr_id: int) -> Dict[str, Any]:
        """Remove approval from a pull request."""
        url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/pullrequests/{pr_id}/approve"
        
        try:
            response = requests.delete(url, headers=self.headers)
            response.raise_for_status()
            return {"status": "unapproved"}
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to unapprove PR: {e}")
            raise
    
    def post_analysis_results(self, pr_id: int, results: Dict[str, Any]):
        """Post analysis results as PR comment."""
        issues = results.get("issues", [])
        metrics = results.get("metrics", {})
        
        # Create summary comment
        summary = "## Lyra Intel Analysis Results\n\n"
        summary += f"**Total Issues:** {len(issues)}\n"
        summary += f"**Complexity:** {metrics.get('complexity', 'N/A')}\n"
        summary += f"**Maintainability:** {metrics.get('maintainability', 'N/A')}\n"
        summary += f"**Security Score:** {metrics.get('security_score', 'N/A')}\n\n"
        
        # Group issues by severity
        critical = [i for i in issues if i.get('severity') == 'critical']
        high = [i for i in issues if i.get('severity') == 'high']
        medium = [i for i in issues if i.get('severity') == 'medium']
        low = [i for i in issues if i.get('severity') == 'low']
        
        if critical:
            summary += f"### 🔴 Critical Issues ({len(critical)})\n"
            for issue in critical[:5]:
                summary += f"- `{issue.get('file')}:{issue.get('line')}` - {issue.get('message')}\n"
        
        if high:
            summary += f"\n### 🟠 High Priority ({len(high)})\n"
            for issue in high[:5]:
                summary += f"- `{issue.get('file')}:{issue.get('line')}` - {issue.get('message')}\n"
        
        if medium:
            summary += f"\n### 🟡 Medium Priority ({len(medium)})\n"
        
        if low:
            summary += f"\n### 🟢 Low Priority ({len(low)})\n"
        
        # Determine if we should approve or request changes
        if len(critical) == 0 and len(high) <= 2:
            summary += "\n\n✅ **Analysis passed with minor issues**"
        else:
            summary += "\n\n⚠️ **Please address critical and high priority issues**"
        
        # Post summary
        self.comment_on_pull_request(pr_id, summary)
        
        # Post inline comments for critical issues
        for issue in critical[:10]:  # Limit to avoid spam
            if issue.get('file') and issue.get('line'):
                try:
                    self.comment_on_pull_request(
                        pr_id,
                        f"**{issue.get('severity').upper()}:** {issue.get('message')}",
                        inline={
                            "path": issue.get('file'),
                            "line": issue.get('line')
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to post inline comment: {e}")
    
    def create_build_status(self, commit_hash: str, state: str, 
                           key: str = "lyra-intel", name: str = "Lyra Intel Analysis",
                           url: Optional[str] = None, description: Optional[str] = None) -> Dict[str, Any]:
        """Create a build status for a commit."""
        status_url = f"{self.base_url}/repositories/{self.workspace}/{self.repo_slug}/commit/{commit_hash}/statuses/build"
        
        data = {
            "state": state,  # INPROGRESS, SUCCESSFUL, FAILED
            "key": key,
            "name": name
        }
        
        if url:
            data["url"] = url
        if description:
            data["description"] = description
        
        try:
            response = requests.post(status_url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create build status: {e}")
            raise
