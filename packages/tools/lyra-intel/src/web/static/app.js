// Lyra Intel Dashboard - Main Application
let analysisInProgress = false;
let currentRepoUrl = '';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', function() {
    setupEventListeners();
    loadRecentAnalyses();
    checkServerStatus();
});

function setupEventListeners() {
    const form = document.getElementById('analyze-form');
    if (form) {
        form.addEventListener('submit', handleAnalyzeSubmit);
    }
    
    // Auto-refresh toggle
    const autoRefresh = document.getElementById('auto-refresh');
    if (autoRefresh) {
        autoRefresh.addEventListener('change', toggleAutoRefresh);
    }
}

async function handleAnalyzeSubmit(e) {
    e.preventDefault();
    
    const repoUrl = document.getElementById('repo-url').value.trim();
    if (!repoUrl) {
        showNotification('Please enter a GitHub repository URL', 'error');
        return;
    }
    
    if (!isValidGitHubUrl(repoUrl)) {
        showNotification('Please enter a valid GitHub URL', 'error');
        return;
    }
    
    await startAnalysis(repoUrl);
}

function isValidGitHubUrl(url) {
    const patterns = [
        /^https?:\/\/(www\.)?github\.com\/[\w-]+\/[\w.-]+\/?$/,
        /^git@github\.com:[\w-]+\/[\w.-]+\.git$/,
        /^[\w-]+\/[\w.-]+$/  // Short form: owner/repo
    ];
    return patterns.some(pattern => pattern.test(url));
}

async function startAnalysis(repoUrl) {
    currentRepoUrl = repoUrl;
    analysisInProgress = true;
    
    updateUIForAnalysis(true);
    showNotification('Starting analysis...', 'info');
    
    try {
        // Get GitHub token if provided
        const githubToken = document.getElementById('github-token')?.value.trim();
        
        const response = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                repo_url: repoUrl,
                features: getSelectedFeatures(),
                github_token: githubToken || undefined  // Only send if provided
            })
        });
        
        if (!response.ok) {
            throw new Error(`Analysis failed: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.status === 'started') {
            showNotification('Analysis started! Tracking progress...', 'success');
            pollAnalysisStatus(result.analysis_id);
        } else {
            throw new Error(result.error || 'Unknown error');
        }
        
    } catch (error) {
        console.error('Analysis error:', error);
        showNotification(`Error: ${error.message}`, 'error');
        updateUIForAnalysis(false);
        analysisInProgress = false;
    }
}

function getSelectedFeatures() {
    const checkboxes = document.querySelectorAll('.feature-checkbox:checked');
    return Array.from(checkboxes).map(cb => cb.value);
}

async function pollAnalysisStatus(analysisId) {
    const pollInterval = setInterval(async () => {
        try {
            const response = await fetch(`/api/analysis/${analysisId}/status`);
            const data = await response.json();
            
            updateProgress(data);
            
            if (data.status === 'completed') {
                clearInterval(pollInterval);
                handleAnalysisComplete(data);
            } else if (data.status === 'failed') {
                clearInterval(pollInterval);
                handleAnalysisFailed(data);
            }
            
        } catch (error) {
            console.error('Status poll error:', error);
        }
    }, 2000);  // Poll every 2 seconds
}

function updateProgress(data) {
    const progressBar = document.getElementById('progress-bar');
    const progressText = document.getElementById('progress-text');
    const currentStep = document.getElementById('current-step');
    
    if (progressBar) {
        progressBar.style.width = `${data.progress || 0}%`;
        progressBar.setAttribute('aria-valuenow', data.progress || 0);
    }
    
    if (progressText) {
        progressText.textContent = `${data.progress || 0}%`;
    }
    
    if (currentStep && data.current_step) {
        currentStep.textContent = data.current_step;
    }
    
    // Update feature status indicators
    if (data.features_status) {
        updateFeatureIndicators(data.features_status);
    }
}

function updateFeatureIndicators(featuresStatus) {
    Object.keys(featuresStatus).forEach(feature => {
        const indicator = document.getElementById(`indicator-${feature}`);
        if (indicator) {
            const status = featuresStatus[feature];
            indicator.className = `feature-indicator status-${status}`;
            
            const icon = indicator.querySelector('.status-icon');
            if (icon) {
                if (status === 'completed') {
                    icon.textContent = '✓';
                } else if (status === 'running') {
                    icon.textContent = '⟳';
                } else if (status === 'failed') {
                    icon.textContent = '✗';
                } else {
                    icon.textContent = '○';
                }
            }
        }
    });
}

function handleAnalysisComplete(data) {
    analysisInProgress = false;
    updateUIForAnalysis(false);
    showNotification('Analysis completed successfully!', 'success');
    
    // Load and display results
    loadAnalysisResults(data.analysis_id);
    
    // Add to recent analyses
    addToRecentAnalyses(currentRepoUrl, data.analysis_id);
}

function handleAnalysisFailed(data) {
    analysisInProgress = false;
    updateUIForAnalysis(false);
    showNotification(`Analysis failed: ${data.error || 'Unknown error'}`, 'error');
}

async function loadAnalysisResults(analysisId) {
    try {
        const response = await fetch(`/api/analysis/${analysisId}/results`);
        const results = await response.json();
        
        // Update all dashboard widgets
        updateDashboardWidgets(results);
        
    } catch (error) {
        console.error('Failed to load results:', error);
        showNotification('Failed to load analysis results', 'error');
    }
}

function updateDashboardWidgets(results) {
    // Update metrics cards
    updateMetricsCards(results.metrics);
    
    // Update dependency graph
    if (results.dependencies && window.updateDependencyGraph) {
        window.updateDependencyGraph(results.dependencies);
    }
    
    // Update file tree
    if (results.files && window.updateFileTree) {
        window.updateFileTree(results.files);
    }
    
    // Update patterns heatmap
    if (results.patterns && window.updatePatternsHeatmap) {
        window.updatePatternsHeatmap(results.patterns);
    }
    
    // Update security dashboard
    if (results.security && window.updateSecurityDashboard) {
        window.updateSecurityDashboard(results.security);
    }
    
    // Update complexity charts
    if (results.complexity && window.updateComplexityCharts) {
        window.updateComplexityCharts(results.complexity);
    }
}

function updateMetricsCards(metrics) {
    const mappings = {
        'metric-files': metrics.total_files,
        'metric-lines': metrics.total_lines,
        'metric-functions': metrics.total_functions,
        'metric-classes': metrics.total_classes,
        'metric-critical': metrics.critical_issues,
        'metric-warnings': metrics.warnings
    };
    
    Object.keys(mappings).forEach(id => {
        const element = document.getElementById(id);
        if (element && mappings[id] !== undefined) {
            animateNumber(element, mappings[id]);
        }
    });
}

function animateNumber(element, targetValue) {
    const duration = 1000;
    const start = parseInt(element.textContent.replace(/,/g, '')) || 0;
    const range = targetValue - start;
    const startTime = performance.now();
    
    function update(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        const currentValue = Math.floor(start + (range * progress));
        element.textContent = currentValue.toLocaleString();
        
        if (progress < 1) {
            requestAnimationFrame(update);
        }
    }
    
    requestAnimationFrame(update);
}

function updateUIForAnalysis(analyzing) {
    const analyzeBtn = document.getElementById('analyze-btn');
    const repoInput = document.getElementById('repo-url');
    const progressSection = document.getElementById('progress-section');
    
    if (analyzeBtn) {
        analyzeBtn.disabled = analyzing;
        analyzeBtn.textContent = analyzing ? '⟳ Analyzing...' : '🔍 Analyze Repository';
    }
    
    if (repoInput) {
        repoInput.disabled = analyzing;
    }
    
    if (progressSection) {
        progressSection.style.display = analyzing ? 'block' : 'none';
    }
}

function showNotification(message, type = 'info') {
    const container = document.getElementById('notification-container') || createNotificationContainer();
    
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-icon">${getNotificationIcon(type)}</span>
        <span class="notification-message">${message}</span>
        <button class="notification-close" onclick="this.parentElement.remove()">×</button>
    `;
    
    container.appendChild(notification);
    
    setTimeout(() => {
        notification.classList.add('notification-show');
    }, 10);
    
    setTimeout(() => {
        notification.classList.remove('notification-show');
        setTimeout(() => notification.remove(), 300);
    }, 5000);
}

function createNotificationContainer() {
    const container = document.createElement('div');
    container.id = 'notification-container';
    container.className = 'notification-container';
    document.body.appendChild(container);
    return container;
}

function getNotificationIcon(type) {
    const icons = {
        success: '✓',
        error: '✗',
        warning: '⚠',
        info: 'ℹ'
    };
    return icons[type] || icons.info;
}

function loadRecentAnalyses() {
    const recent = JSON.parse(localStorage.getItem('recentAnalyses') || '[]');
    const container = document.getElementById('recent-analyses');
    
    if (container && recent.length > 0) {
        container.innerHTML = recent.slice(0, 5).map(item => `
            <div class="recent-item" onclick="loadAnalysis('${item.id}')">
                <div class="recent-repo">${item.repo}</div>
                <div class="recent-date">${new Date(item.date).toLocaleDateString()}</div>
            </div>
        `).join('');
    }
}

function addToRecentAnalyses(repoUrl, analysisId) {
    const recent = JSON.parse(localStorage.getItem('recentAnalyses') || '[]');
    recent.unshift({
        repo: repoUrl,
        id: analysisId,
        date: new Date().toISOString()
    });
    localStorage.setItem('recentAnalyses', JSON.stringify(recent.slice(0, 10)));
    loadRecentAnalyses();
}

async function loadAnalysis(analysisId) {
    showNotification('Loading analysis...', 'info');
    await loadAnalysisResults(analysisId);
}

async function checkServerStatus() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        
        const statusEl = document.getElementById('server-status');
        if (statusEl) {
            statusEl.className = 'server-status status-healthy';
            statusEl.textContent = '● Online';
        }
    } catch (error) {
        const statusEl = document.getElementById('server-status');
        if (statusEl) {
            statusEl.className = 'server-status status-error';
            statusEl.textContent = '● Offline';
        }
    }
}

function toggleAutoRefresh(e) {
    const enabled = e.target.checked;
    if (enabled) {
        window.refreshInterval = setInterval(() => {
            if (!analysisInProgress) {
                checkServerStatus();
            }
        }, 30000);  // 30 seconds
    } else {
        if (window.refreshInterval) {
            clearInterval(window.refreshInterval);
        }
    }
}

// Export data
function exportResults(format = 'json') {
    const analysisId = getCurrentAnalysisId();
    if (!analysisId) {
        showNotification('No analysis to export', 'warning');
        return;
    }
    
    window.location.href = `/api/analysis/${analysisId}/export?format=${format}`;
}

function getCurrentAnalysisId() {
    // Get from URL or storage
    const params = new URLSearchParams(window.location.search);
    return params.get('analysis_id') || localStorage.getItem('currentAnalysisId');
}

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    // Ctrl/Cmd + K for quick search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        document.getElementById('repo-url')?.focus();
    }
    
    // Escape to clear
    if (e.key === 'Escape') {
        const input = document.getElementById('repo-url');
        if (input && document.activeElement === input) {
            input.value = '';
        }
    }
});
