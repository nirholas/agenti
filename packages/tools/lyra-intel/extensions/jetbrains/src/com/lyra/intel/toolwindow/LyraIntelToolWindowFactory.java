package com.lyra.intel.toolwindow;

import com.intellij.openapi.project.Project;
import com.intellij.openapi.wm.ToolWindow;
import com.intellij.openapi.wm.ToolWindowFactory;
import com.intellij.ui.content.Content;
import com.intellij.ui.content.ContentFactory;
import org.jetbrains.annotations.NotNull;

/**
 * Factory for creating the Lyra Intel tool window.
 */
public class LyraIntelToolWindowFactory implements ToolWindowFactory {

    @Override
    public void createToolWindowContent(@NotNull Project project, @NotNull ToolWindow toolWindow) {
        LyraIntelToolWindow lyraToolWindow = new LyraIntelToolWindow(project);
        ContentFactory contentFactory = ContentFactory.SERVICE.getInstance();
        Content content = contentFactory.createContent(lyraToolWindow.getContent(), "", false);
        toolWindow.getContentManager().addContent(content);

        // Register as service
        project.getService(LyraIntelToolWindow.class);
    }
}
