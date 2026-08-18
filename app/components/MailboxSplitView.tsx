// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { ReactNode } from "react";
import ComposePanel from "~/components/ComposePanel";
import EmailPanel from "~/components/EmailPanel";

interface MailboxSplitViewProps {
	selectedEmailId: string | null;
	isComposing: boolean;
	children: ReactNode;
}

export default function MailboxSplitView({
	selectedEmailId,
	isComposing,
	children,
}: MailboxSplitViewProps) {
	const isPanelOpen = selectedEmailId !== null || isComposing;

	return (
		<div className="flex flex-row h-full w-full min-w-0 overflow-hidden">
			<div
				className={`flex flex-col min-w-0 overflow-hidden ${
					isPanelOpen
						? "hidden md:flex md:w-[min(28rem,42%)] md:min-w-[18rem] md:max-w-[32rem] md:shrink-0 md:border-r md:border-kumo-line"
						: "flex-1 w-full"
				}`}
			>
				{children}
			</div>
			{isPanelOpen && (
				<div className="flex-1 flex flex-col min-w-0 overflow-hidden">
					{isComposing && !selectedEmailId ? (
						<ComposePanel />
					) : isComposing && selectedEmailId ? (
						<div className="flex flex-col h-full min-w-0 overflow-hidden">
							<ComposePanel />
							<div className="border-t border-kumo-line min-w-0 overflow-hidden">
								<EmailPanel emailId={selectedEmailId} />
							</div>
						</div>
					) : selectedEmailId ? (
						<EmailPanel emailId={selectedEmailId} />
					) : null}
				</div>
			)}
		</div>
	);
}
