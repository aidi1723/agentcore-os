/**
 * ApprovalCard Component
 *
 * 人工审批点的强化卡片组件
 * 核心特点：醒目、大号、带预览、不可忽视
 *
 * @example
 * <ApprovalCard
 *   playbook="sales-pipeline-v1"
 *   stepTitle="生成合同草稿"
 *   stepId="step-3"
 *   content={{
 *     preview: "合同内容预览...",
 *     metadata: { customer: "张三公司", amount: "100万" }
 *   }}
 *   onApprove={() => {}}
 *   onReject={() => {}}
 *   loading={false}
 * />
 */

import { forwardRef, useState } from 'react';
import { clsx } from 'clsx';
import { ShieldCheck, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp } from 'lucide-react';
import styles from './ApprovalCard.module.css';

export interface ApprovalCardProps {
  /** Playbook ID */
  playbook: string;
  /** 步骤标题 */
  stepTitle: string;
  /** 步骤 ID */
  stepId: string;
  /** 待审批的内容 */
  content?: {
    preview?: string;
    metadata?: Record<string, string | number>;
    fullContent?: string;
  };
  /** 审批中状态 */
  loading?: boolean;
  /** 批准回调 */
  onApprove: () => void;
  /** 拒绝回调 */
  onReject: () => void;
  /** 额外类名 */
  className?: string;
}

export const ApprovalCard = forwardRef<HTMLDivElement, ApprovalCardProps>(
  (
    {
      playbook,
      stepTitle,
      stepId,
      content,
      loading = false,
      onApprove,
      onReject,
      className,
    },
    ref
  ) => {
    const [expanded, setExpanded] = useState(false);

    return (
      <div
        ref={ref}
        className={clsx(styles.card, className)}
        role="alert"
        aria-live="assertive"
      >
        {/* 警告头部 */}
        <div className={styles.card__header}>
          <div className={styles.card__icon}>
            <ShieldCheck className="w-8 h-8" />
          </div>
          <div className={styles.card__heading}>
            <h3 className={styles.card__title}>
              <AlertTriangle className="w-5 h-5" />
              需要您的审批
            </h3>
            <p className={styles.card__subtitle}>
              在继续执行前，请审查以下内容并做出决定
            </p>
          </div>
        </div>

        {/* Playbook 和步骤信息 */}
        <div className={styles.card__meta}>
          <div className={styles.meta__item}>
            <span className={styles.meta__label}>Playbook:</span>
            <span className={styles.meta__value}>{playbook}</span>
          </div>
          <div className={styles.meta__item}>
            <span className={styles.meta__label}>步骤:</span>
            <span className={styles.meta__value}>{stepTitle}</span>
          </div>
          <div className={styles.meta__item}>
            <span className={styles.meta__label}>步骤 ID:</span>
            <span className={styles.meta__value}>{stepId}</span>
          </div>
        </div>

        {/* 内容预览 */}
        {content && (
          <div className={styles.card__content}>
            <div className={styles.content__header}>
              <span className={styles.content__label}>待审批内容</span>
              {content.fullContent && (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className={styles.content__toggle}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="w-4 h-4" />
                      收起
                    </>
                  ) : (
                    <>
                      <ChevronDown className="w-4 h-4" />
                      展开完整内容
                    </>
                  )}
                </button>
              )}
            </div>

            {/* 元数据 */}
            {content.metadata && Object.keys(content.metadata).length > 0 && (
              <div className={styles.content__metadata}>
                {Object.entries(content.metadata).map(([key, value]) => (
                  <div key={key} className={styles.metadata__item}>
                    <span className={styles.metadata__key}>{key}:</span>
                    <span className={styles.metadata__value}>{value}</span>
                  </div>
                ))}
              </div>
            )}

            {/* 预览 */}
            {content.preview && (
              <div className={styles.content__preview}>
                {content.preview}
              </div>
            )}

            {/* 完整内容（展开时显示） */}
            {expanded && content.fullContent && (
              <div className={styles.content__full}>
                {content.fullContent}
              </div>
            )}
          </div>
        )}

        {/* 操作按钮 */}
        <div className={styles.card__actions}>
          <button
            type="button"
            onClick={onApprove}
            disabled={loading}
            className={clsx(styles.action, styles['action--approve'])}
          >
            <CheckCircle2 className="w-5 h-5" />
            {loading ? '处理中...' : '批准并继续'}
          </button>
          <button
            type="button"
            onClick={onReject}
            disabled={loading}
            className={clsx(styles.action, styles['action--reject'])}
          >
            <XCircle className="w-5 h-5" />
            {loading ? '处理中...' : '拒绝'}
          </button>
        </div>

        {/* 警告提示 */}
        <div className={styles.card__notice}>
          <AlertTriangle className="w-4 h-4" />
          <span>
            批准后将继续执行下一步骤。拒绝后执行将终止，不会写入任何业务资产。
          </span>
        </div>
      </div>
    );
  }
);

ApprovalCard.displayName = 'ApprovalCard';
