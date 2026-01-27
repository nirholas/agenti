package com.lyra.intel.actions;

import com.intellij.openapi.actionSystem.AnAction;
import com.intellij.openapi.actionSystem.AnActionEvent;
import com.intellij.openapi.actionSystem.CommonDataKeys;
import com.intellij.openapi.editor.Document;
import com.intellij.openapi.editor.Editor;
import com.intellij.openapi.fileEditor.FileDocumentManager;
import com.intellij.openapi.progress.ProgressIndicator;
import com.intellij.openapi.progress.ProgressManager;
import com.intellij.openapi.progress.Task;
import com.intellij.openapi.project.Project;
import com.intellij.openapi.ui.Messages;
import com.intellij.openapi.vfs.VirtualFile;
import com.lyra.intel.client.LyraIntelClient;
import com.lyra.intel.client.AnalysisResult;
import com.lyra.intel.settings.LyraIntelSettings;
import com.lyra.intel.toolwindow.LyraIntelToolWindow;
import org.jetbrains.annotations.NotNull;

/**
 * Action to analyze the current file.
 */
public class AnalyzeFileAction extends AnAction {

    @Override
    public void actionPerformed(@NotNull AnActionEvent e) {
        Project project = e.getProject();
        if (project == null) {
            return;
        }

        Editor editor = e.getData(CommonDataKeys.EDITOR);
        if (editor == null) {
            Messages.showErrorDialog(project, "No file is currently open", "Lyra Intel");
            return;
        }

        Document document = editor.getDocument();
        VirtualFile file = FileDocumentManager.getInstance().getFile(document);
        if (file == null) {
            Messages.showErrorDialog(project, "Cannot determine file", "Lyra Intel");
            return;
        }

        String content = document.getText();
        String language = getLanguageFromExtension(file.getExtension());

        // Run analysis in background
        ProgressManager.getInstance().run(new Task.Backgroundable(project, "Analyzing with Lyra Intel", false) {
            @Override
            public void run(@NotNull ProgressIndicator indicator) {
                indicator.setIndeterminate(true);
                indicator.setText("Analyzing " + file.getName());

                try {
                    LyraIntelSettings settings = LyraIntelSettings.getInstance();
                    LyraIntelClient client = new LyraIntelClient(
                        settings.getApiUrl(),
                        settings.getApiKey()
                    );

                    AnalysisResult result = client.analyzeFile(content, language);
                    client.close();

                    // Update tool window with results
                    LyraIntelToolWindow toolWindow = project.getService(LyraIntelToolWindow.class);
                    if (toolWindow != null) {
                        toolWindow.updateResults(result);
                    }

                    // Show notification
                    int issueCount = result.getIssues() != null ? result.getIssues().size() : 0;
                    Messages.showInfoMessage(
                        project,
                        "Analysis complete. Found " + issueCount + " issues.",
                        "Lyra Intel"
                    );

                } catch (Exception ex) {
                    Messages.showErrorDialog(
                        project,
                        "Analysis failed: " + ex.getMessage(),
                        "Lyra Intel"
                    );
                }
            }
        });
    }

    @Override
    public void update(@NotNull AnActionEvent e) {
        // Enable only when editor is available
        Editor editor = e.getData(CommonDataKeys.EDITOR);
        e.getPresentation().setEnabled(editor != null);
    }

    private String getLanguageFromExtension(String extension) {
        if (extension == null) {
            return "text";
        }

        switch (extension.toLowerCase()) {
            case "java":
                return "java";
            case "py":
                return "python";
            case "js":
                return "javascript";
            case "ts":
                return "typescript";
            case "kt":
                return "kotlin";
            case "go":
                return "go";
            case "rs":
                return "rust";
            case "cpp":
            case "cc":
            case "cxx":
                return "cpp";
            case "cs":
                return "csharp";
            case "rb":
                return "ruby";
            case "php":
                return "php";
            default:
                return "text";
        }
    }
}
