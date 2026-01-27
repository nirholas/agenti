"""
GitLab integration for Lyra Intel.
"""

import requests
from typing import Dict, Any, List, Optional
import logging

logger = logging.getLogger(__name__)


class GitLabIntegration:
    """Integration with GitLab for MR comments and issue creation."""
    
    def __init__(self, gitlab_url: str, access_token: str, project_id: str):
        self.gitlab_url = gitlab_url.rstrip('/')
        self.access_token = access_token
        self.project_id = project_id
        self.api_url = f"{self.gitlab_url}/api/v4"
        self.headers = {
            "PRIVATE-TOKEN": access_token,
            "Content-Type": "application/json"
        }
    
    def create_issue(self, title: str, description: str, labels: List[str] = None) -> Dict[str, Any]:
        """Create an issue in GitLab."""
        url = f"{self.api_url}/projects/{self.project_id}/issues"
        
        data = {
            "title": title,
            "description": description
        }
        
        if labels:
            data["labels"] = ",".join(labels)
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to create GitLab issue: {e}")
            raise
    
    def comment_on_merge_request(self, mr_iid: int, comment: str, line: Optional[int] = None, 
                                  file_path: Optional[str] = None) -> Dict[str, Any]:
        """Add a comment to a merge request."""
        if line and file_path:
            # Add inline comment
            return self._add_mr_discussion(mr_iid, comment, line, file_path)
        else:
            # Add general note
            return self._add_mr_note(mr_iid, comment)
    
    def _add_mr_note(self, mr_iid: int, comment: str) -> Dict[str, Any]:
        """Add a general note to a merge request."""
        url = f"{self.api_url}/projects/{self.project_id}/merge_requests/{mr_iid}/notes"
        
        data = {"body": comment}
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to add MR note: {e}")
            raise
    
    def _add_mr_discussion(self, mr_iid: int, comment: str, line: int, file_path: str) -> Dict[str, Any]:
        """Add an inline discussion to a merge request."""
        url = f"{self.api_url}/projects/{self.project_id}/merge_requests/{mr_iid}/discussions"
        
        # Get the latest commit SHA for the MR
        mr_data = self.get_merge_request(mr_iid)
        base_sha = mr_data.get("diff_refs", {}).get("base_sha")
        head_sha = mr_data.get("diff_refs", {}).get("head_sha")
        start_sha = mr_data.get("diff_refs", {}).get("start_sha")
        
        data = {
            "body": comment,
            "position": {
                "position_type": "text",
                "new_path": file_path,
                "new_line": line,
                "base_sha": base_sha,
                "head_sha": head_sha,
                "start_sha": start_sha
            }
        }
        
        try:
            response = requests.post(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to add MR discussion: {e}")
            raise
    
    def get_merge_request(self, mr_iid: int) -> Dict[str, Any]:
        """Get merge request details."""
        url = f"{self.api_url}/projects/{self.project_id}/merge_requests/{mr_iid}"
        
        try:
            response = requests.get(url, headers=self.headers)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to get merge request: {e}")
            raise
    
    def update_merge_request_status(self, mr_iid: int, state_event: str) -> Dict[str, Any]:
        """Update merge request status (approve, unapprove, close, reopen)."""
        url = f"{self.api_url}/projects/{self.project_id}/merge_requests/{mr_iid}"
        
        data = {"state_event": state_event}
        
        try:
            response = requests.put(url, headers=self.headers, json=data)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to update MR status: {e}")
            raise
    
    def post_analysis_results(self, mr_iid: int, results: Dict[str, Any]):
        """Post analysis results as MR comment."""
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
                summary += f"- {issue.get('file')}:{issue.get('line')} - {issue.get('message')}\n"
        
        if high:
            summary += f"\n### 🟠 High Priority ({len(high)})\n"
            for issue in high[:5]:
                summary += f"- {issue.get('file')}:{issue.get('line')} - {issue.get('message')}\n"
        
        if medium:
            summary += f"\n### 🟡 Medium Priority ({len(medium)})\n"
        
        if low:
            summary += f"\n### 🟢 Low Priority ({len(low)})\n"
        
        # Post summary
        self.comment_on_merge_request(mr_iid, summary)
        
        # Post inline comments for critical issues
        for issue in critical[:10]:  # Limit to avoid spam
            if issue.get('file') and issue.get('line'):
                try:
                    self.comment_on_merge_request(
                        mr_iid,
                        f"**{issue.get('severity').upper()}:** {issue.get('message')}",
                        line=issue.get('line'),
                        file_path=issue.get('file')
                    )
                except Exception as e:
                    logger.warning(f"Failed to post inline comment: {e}")
