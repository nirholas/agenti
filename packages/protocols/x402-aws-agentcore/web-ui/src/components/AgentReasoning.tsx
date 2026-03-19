/**
 * AgentReasoning Component
 * 
 * Displays the agent's reasoning process in real-time, including:
 * - Thought process and analysis
 * - Tool invocations with inputs/outputs
 * - Timeline of reasoning steps
 */

import { useState, useEffect, useRef } from 'react';
import type { AgentReasoning as AgentReasoningType, AgentTrace } from '../api';
import './AgentReasoning.css';

export interface ReasoningStep {
  id: string;
  timestamp: Date;
  type: 'thought' | 'tool_use' | 'tool_result' | 'observation' | 'decision';
  content: string;
  tool?: string;
  toolInput?: unknown;
  toolOutput?: unknown;
  status: 'pending' | 'active' | 'complete' | 'error';
}

interface AgentReasoningProps {
  /** Raw reasoning steps from the hook */
  reasoning: AgentReasoningType[];
  /** Streaming text from the agent */
  streamingText: string;
  /** Agent traces for detailed analysis */
  traces?: AgentTrace[];
  /** Whether the agent is currently processing */
  isProcessing: boolean;
  /** Whether to show in expanded mode */
  expanded?: boolean;
  /** Callback when user toggles expansion */
  onToggleExpand?: () => void;
}

// Icons for different step types
const STEP_ICONS: Record<ReasoningStep['type'], string> = {
  thought: '💭',
  tool_use: '🔧',
  tool_result: '📤',
  observation: '👁️',
  decision: '✅',
};

// Labels for step types
const STEP_LABELS: Record<ReasoningStep['type'], string> = {
  thought: 'Thinking',
  tool_use: 'Using Tool',
  tool_result: 'Tool Result',
  observation: 'Observation',
  decision: 'Decision',
};

// Helper to format JSON for display
function formatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function AgentReasoning({
  reasoning,
  streamingText,
  traces = [],
  isProcessing,
  expanded = true,
  onToggleExpand,
}: AgentReasoningProps) {
  const [steps, setSteps] = useState<ReasoningStep[]>([]);
  const [isExpanded, setIsExpanded] = useState(expanded);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse reasoning and traces into display steps
  useEffect(() => {
    const newSteps: ReasoningStep[] = [];

    // Parse from reasoning array
    reasoning.forEach((r, index) => {
      newSteps.push({
        id: `reasoning-${index}`,
        timestamp: new Date(),
        type: r.tool ? 'tool_use' : 'thought',
        content: r.description,
        tool: r.tool,
        toolInput: r.toolInput,
        toolOutput: r.toolOutput,
        status: 'complete',
      });
    });

    // Parse from traces for more detailed info
    traces.forEach((trace, index) => {
      if (trace.type === 'orchestration' && trace.data) {
        const data = trace.data as Record<string, unknown>;
        
        if (data.rationale && typeof data.rationale === 'string') {
          // Check if this rationale is already captured
          const exists = newSteps.some(s => s.content === data.rationale);
          if (!exists) {
            newSteps.push({
              id: `trace-${index}`,
              timestamp: new Date(trace.timestamp || Date.now()),
              type: data.actionGroup ? 'tool_use' : 'thought',
              content: data.rationale as string,
              tool: data.actionGroup as string | undefined,
              toolInput: data.actionGroupInput,
              status: 'complete',
            });
          }
        }
      }
    });

    setSteps(newSteps);
  }, [reasoning, traces]);

  // Auto-scroll to bottom when new steps arrive
  useEffect(() => {
    if (containerRef.current && isExpanded) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [steps, streamingText, isExpanded]);

  const handleToggle = () => {
    setIsExpanded(!isExpanded);
    onToggleExpand?.();
  };

  // Parse streaming text for real-time display
  const parseStreamingContent = (text: string): string[] => {
    if (!text) return [];
    
    // Split by common delimiters in agent responses
    const lines = text.split(/\n+/).filter(line => line.trim());
    return lines;
  };

  const streamingLines = parseStreamingContent(streamingText);
  const hasContent = steps.length > 0 || streamingText.length > 0;

  if (!hasContent && !isProcessing) {
    return null;
  }

  return (
    <div className={`agent-reasoning-panel ${isExpanded ? 'expanded' : 'collapsed'}`}>
      <div className="reasoning-header" onClick={handleToggle}>
        <div className="reasoning-title">
          <span className="reasoning-icon">🤖</span>
          <span>Agent Reasoning</span>
          {isProcessing && <span className="processing-indicator" />}
        </div>
        <div className="reasoning-controls">
          {steps.length > 0 && (
            <span className="step-count">{steps.length} steps</span>
          )}
          <button className="toggle-btn" aria-label={isExpanded ? 'Collapse' : 'Expand'}>
            {isExpanded ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="reasoning-content" ref={containerRef}>
          {/* Completed reasoning steps */}
          {steps.map((step) => (
            <ReasoningStepItem key={step.id} step={step} />
          ))}

          {/* Current streaming content */}
          {isProcessing && streamingText && (
            <div className="streaming-section">
              <div className="streaming-header">
                <span className="streaming-icon">💭</span>
                <span>Current Thought</span>
                <span className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </span>
              </div>
              <div className="streaming-content">
                {streamingLines.map((line, index) => (
                  <p key={index} className="streaming-line">{line}</p>
                ))}
              </div>
            </div>
          )}

          {/* Processing indicator when no content yet */}
          {isProcessing && !streamingText && steps.length === 0 && (
            <div className="processing-placeholder">
              <div className="processing-animation">
                <span></span>
                <span></span>
                <span></span>
              </div>
              <span>Agent is thinking...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Individual reasoning step component
interface ReasoningStepItemProps {
  step: ReasoningStep;
}

function ReasoningStepItem({ step }: ReasoningStepItemProps) {
  const [showDetails, setShowDetails] = useState(false);
  const hasDetails = Boolean(step.toolInput) || Boolean(step.toolOutput);

  return (
    <div className={`reasoning-step step-${step.type} step-status-${step.status}`}>
      <div className="step-timeline">
        <div className="step-dot" />
        <div className="step-line" />
      </div>
      
      <div className="step-body">
        <div className="step-header">
          <span className="step-icon">{STEP_ICONS[step.type]}</span>
          <span className="step-type">{STEP_LABELS[step.type]}</span>
          {step.tool && (
            <span className="step-tool">{step.tool}</span>
          )}
          <span className="step-time">
            {step.timestamp.toLocaleTimeString()}
          </span>
        </div>
        
        <div className="step-content">
          {step.content}
        </div>

        {hasDetails && (
          <>
            <button 
              className="details-toggle"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide Details' : 'Show Details'}
            </button>
            
            {showDetails && (
              <div className="step-details">
                {step.toolInput !== undefined && step.toolInput !== null && (
                  <div className="detail-section">
                    <span className="detail-label">Input:</span>
                    <pre className="detail-code">
                      {formatJson(step.toolInput)}
                    </pre>
                  </div>
                )}
                {step.toolOutput !== undefined && step.toolOutput !== null && (
                  <div className="detail-section">
                    <span className="detail-label">Output:</span>
                    <pre className="detail-code">
                      {formatJson(step.toolOutput)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default AgentReasoning;
