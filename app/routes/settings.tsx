// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Badge, Button, Input, Loader, useKumoToastManager } from "@cloudflare/kumo";
import { RobotIcon, ArrowCounterClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { useMailbox, useUpdateMailbox } from "~/queries/mailboxes";

// Placeholder shown in the textarea when no custom prompt is set.
// The authoritative default prompt lives in workers/agent/index.ts (DEFAULT_SYSTEM_PROMPT).
const PROMPT_PLACEHOLDER = `You are an email assistant that helps manage this inbox. You read emails, draft replies, and help organize conversations.\n\nWrite like a real person. Short, direct, flowing prose. Plain text only.\n\n(Leave empty to use the full built-in default prompt)`;

export default function SettingsRoute() {
	const { mailboxId } = useParams<{ mailboxId: string }>();
	const toastManager = useKumoToastManager();
	const { data: mailbox } = useMailbox(mailboxId);
	const updateMailboxMutation = useUpdateMailbox();

	const [displayName, setDisplayName] = useState("");
	const [signatureEnabled, setSignatureEnabled] = useState(false);
	const [signatureText, setSignatureText] = useState("");
	const [agentPrompt, setAgentPrompt] = useState("");
	const [isSaving, setIsSaving] = useState(false);

	useEffect(() => {
		if (mailbox) {
			setDisplayName(mailbox.settings?.fromName || mailbox.name || "");
			setSignatureEnabled(Boolean(mailbox.settings?.signature?.enabled));
			setSignatureText(mailbox.settings?.signature?.text || "");
			setAgentPrompt(mailbox.settings?.agentSystemPrompt || "");
		}
	}, [mailbox]);

	const handleSave = async () => {
		if (!mailbox || !mailboxId) return;
		setIsSaving(true);
		const settings = {
			...mailbox.settings,
			fromName: displayName,
			signature: {
				enabled: signatureEnabled,
				text: signatureText,
			},
			agentSystemPrompt: agentPrompt.trim() || undefined,
		};
		try {
			await updateMailboxMutation.mutateAsync({ mailboxId, settings });
			toastManager.add({ title: "设置已保存" });
		} catch {
			toastManager.add({
				title: "保存设置失败",
				variant: "error",
			});
		} finally {
			setIsSaving(false);
		}
	};

	const handleResetPrompt = () => {
		setAgentPrompt("");
	};

	if (!mailbox) {
		return (
			<div className="flex justify-center py-20">
				<Loader size="lg" />
			</div>
		);
	}

	const isCustomPrompt = agentPrompt.trim().length > 0;

	return (
		<div className="max-w-2xl px-4 py-4 md:px-8 md:py-6 h-full overflow-y-auto">
			<h1 className="text-lg font-semibold text-kumo-default mb-6">设置</h1>

			<div className="space-y-6">
				{/* Identity */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="text-sm font-medium text-kumo-default mb-4">
						身份
					</div>
					<div className="space-y-3">
						<Input
							label="显示名"
							placeholder="发信时显示的名字"
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
						/>
						<Input label="邮箱地址" type="email" value={mailbox.email} disabled />
					</div>
				</div>

				{/* Signature */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="flex items-center justify-between mb-3">
						<div className="text-sm font-medium text-kumo-default">签名</div>
						<label className="flex items-center gap-2 text-sm text-kumo-default cursor-pointer">
							<input
								type="checkbox"
								checked={signatureEnabled}
								onChange={(e) => setSignatureEnabled(e.target.checked)}
							/>
							启用签名
						</label>
					</div>
					<p className="text-xs text-kumo-subtle mb-3">
						未启用或签名为空时，写信会使用首页的默认签名模板。
					</p>
					<textarea
						value={signatureText}
						onChange={(e) => setSignatureText(e.target.value)}
						placeholder="写在邮件末尾的签名"
						rows={5}
						disabled={!signatureEnabled}
						className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring disabled:opacity-60"
					/>
				</div>

				{/* Agent System Prompt */}
				<div className="rounded-lg border border-kumo-line bg-kumo-base p-5">
					<div className="flex items-center justify-between mb-4">
						<div className="flex items-center gap-2">
							<RobotIcon size={16} weight="duotone" className="text-kumo-subtle" />
							<span className="text-sm font-medium text-kumo-default">
								AI 助手提示词
							</span>
							{isCustomPrompt ? (
								<Badge variant="primary">自定义</Badge>
							) : (
								<Badge variant="secondary">默认</Badge>
							)}
						</div>
						{isCustomPrompt && (
							<Button
								variant="ghost"
								size="xs"
								icon={<ArrowCounterClockwiseIcon size={14} />}
								onClick={handleResetPrompt}
							>
								恢复默认
							</Button>
						)}
					</div>
					<p className="text-xs text-kumo-subtle mb-3">
						自定义这个邮箱里 AI 助手的语气和规则。留空则使用内置默认提示词。
					</p>
					<textarea
						value={agentPrompt}
						onChange={(e) => setAgentPrompt(e.target.value)}
						placeholder={PROMPT_PLACEHOLDER}
						rows={8}
						className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-xs text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring font-mono leading-relaxed"
					/>
					<p className="text-xs text-kumo-subtle mt-2">
						这段文字会作为系统提示发送给模型，用来控制助手的个性和回复风格。
					</p>
				</div>

				{/* Save */}
				<div className="flex justify-end">
					<Button variant="primary" onClick={handleSave} loading={isSaving}>
						保存
					</Button>
				</div>
			</div>
		</div>
	);
}
