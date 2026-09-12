/**
 * PipelineFlow Component
 *
 * 可控 Playbook Runtime 的核心可视化组件
 * 横向展示 Playbook 执行流程，清晰标识当前步骤、审批点和执行状态
 *
 * @example
 * <PipelineFlow
 *   steps={[
 *     { id: '1', title: '分析客户意向', state: 'completed' },
 *     { id: '2', title: '生成方案草稿', state: 'running' },
 *     { id: 'approval-1', title: '审批方案', state: 'awaiting', isApproval: true },
 *     { id: '3', title: '起草合同', state: 'pending' },
 *   ]}
 *   currentStepId="2"
 *   onStepClick={(stepId) => console.log('Clicked:', stepId)}
 * />
 */

import { forwardRef } from 'react';
import { clsx } from 'clsx';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  Circle,
  ShieldCheck,
  Loader2
} from 'lucide-react';
import styles from './PipelineFlow.module.css';

export type PipelineStepState =
  | 'completed'
  | 'running'
  | 'awaiting'
  | 'failed'
  | 'pending';

export interface PipelineStep {
  id: string;
  title: string;
  state: PipelineStepState;
  isApproval?: boolean;
  error?: string;
  duration?: number;
}

export interface PipelineFlowProps {
  steps: PipelineStep[];
  currentStepId?: string;
  onStepClick?: (stepId: string) => void;
  className?: string;
}

function getStepIcon(state: PipelineStepState, isApproval?: boolean) {
  if (isApproval && state === 'awaiting') {
    return <ShieldCheck className="w-5 h-5" />;
  }

  switch (state) {
    case 'completed':
      return <CheckCircle2 className="w-5 h-5" />;
    case 'running':
      return <Loader2 className="w-5 h-5 animate-spin" />;
    case 'awaiting':
      return <Clock className="w-5 h-5" />;
    case 'failed':
      return <AlertCircle className="w-5 h-5" />;
    case 'pending':
      return <Circle className="w-5 h-5" />;
    default:
      return <Circle className="w-5 h-5" />;
  }
}

export const PipelineFlow = forwardRef<HTMLDivElement, PipelineFlowProps>(
  ({ steps, currentStepId, onStepClick, className }, ref) => {
    return (
      <div ref={ref} className={clsx(styles.pipeline, className)}>
        <div className={styles.pipeline__track}>
          {steps.map((step, index) => {
            const isCurrent = step.id === currentStepId;
            const isClickable = !!onStepClick;

            return (
              <div key={step.id} className={styles.pipeline__item}>
                {/* 步骤节点 */}
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(step.id)}
                  disabled={!isClickable}
                  className={clsx(
                    styles.step,
                    styles[`step--${step.state}`],
                    step.isApproval && styles['step--approval'],
                    isCurrent && styles['step--current'],
                    isClickable && styles['step--clickable']
                  )}
                  aria-label={`${step.title} - ${step.state}`}
                >
                  <div className={styles.step__icon}>
                    {getStepIcon(step.state, step.isApproval)}
                  </div>

                  <div className={styles.step__content}>
                    <div className={styles.step__title}>
                      {step.title}
                    </div>

                    {step.isApproval && (
                      <div className={styles.step__badge}>
                        审批点
                      </div>
                    )}

                    {step.error && (
                      <div className={styles.step__error}>
                        {step.error}
                      </div>
                    )}

                    {step.duration !== undefined && step.state === 'completed' && (
                      <div className={styles.step__duration}>
                        {(step.duration / 1000).toFixed(1)}s
                      </div>
                    )}
                  </div>
                </button>

                {/* 连接线 */}
                {index < steps.length - 1 && (
                  <div
                    className={clsx(
                      styles.connector,
                      step.state === 'completed' && styles['connector--completed']
                    )}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }
);

PipelineFlow.displayName = 'PipelineFlow';
