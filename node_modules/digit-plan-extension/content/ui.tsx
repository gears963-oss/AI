import React from 'react';
import { createRoot } from 'react-dom/client';
import type { Prospect, ScoreResult } from '@shared/types';

const STYLE_ID = 'digit-plan-widget-styles';

function ensureStyles(): void {
	if (document.getElementById(STYLE_ID)) return;
	const style = document.createElement('style');
	style.id = STYLE_ID;
	style.textContent = `
.digit-plan__widget {
  position: fixed;
  bottom: 16px;
  right: 16px;
  background: #0f172a;
  color: #fff;
  padding: 12px 14px;
  border-radius: 10px;
  box-shadow: 0 6px 24px rgba(2,6,23,0.4);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  width: 320px;
  z-index: 2147483647;
}
.digit-plan__title {
  margin: 0 0 8px;
  font-size: 14px;
}
.digit-plan__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.digit-plan__score {
  font-weight: 700;
  font-size: 18px;
}
.digit-plan__explain {
  margin-top: 8px;
  font-size: 12px;
  color: #cbd5e1;
}
`;
	document.head.appendChild(style);
}

function Widget(props: { prospect?: Partial<Prospect>; result?: ScoreResult | null }): JSX.Element {
	const { prospect, result } = props;
	return (
		<div className="digit-plan__widget">
			<h4 className="digit-plan__title">Digit Plan</h4>
			<div className="digit-plan__row">
				<span>Prospect</span>
				<span>{prospect?.name || prospect?.company || 'Unknown'}</span>
			</div>
			<div className="digit-plan__row" style={{ marginTop: 6 }}>
				<span>Score</span>
				<span className="digit-plan__score">{result?.score ?? '—'}</span>
			</div>
			{result?.reasons?.length ? (
				<div className="digit-plan__explain">
					{result.reasons.slice(0, 3).map((r, i) => (
						<div key={i}>• {r}</div>
					))}
				</div>
			) : null}
			<div style={{ marginTop: 10, textAlign: 'right' }}>
				<button
					onClick={() => chrome.runtime.sendMessage({ type: 'SCORE_ICP' })}
					style={{
						background: '#22c55e',
						border: 'none',
						color: '#0f172a',
						padding: '6px 10px',
						borderRadius: 8,
						cursor: 'pointer',
						fontWeight: 700
					}}
				>
					Score ICP
				</button>
			</div>
		</div>
	);
}

function mount(): (data: { prospect?: Partial<Prospect>; explanation?: ScoreExplanation | null }) => void {
	ensureStyles();
	let container = document.getElementById('digit-plan-widget');
	if (!container) {
		container = document.createElement('div');
		container.id = 'digit-plan-widget';
		document.body.appendChild(container);
	}
	const root = createRoot(container);
	return (data) => {
		root.render(<Widget prospect={data.prospect} result={data.result ?? null} />);
	};
}

const render = mount();

chrome.runtime.onMessage.addListener((message) => {
	if (message?.type === 'WIDGET_UPDATE') {
		render(message.payload || {});
	}
});


