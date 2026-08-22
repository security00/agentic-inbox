// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Input } from "@cloudflare/kumo";
import { FloppyDiskIcon, PaperPlaneTiltIcon, XIcon, PaperclipIcon } from "@phosphor-icons/react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import RichTextEditor from "./RichTextEditor";
import { formatBytes } from "~/lib/utils";
import { useRef } from "react";

export default function ComposePanel() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	const fileInputRef = useRef<HTMLInputElement>(null);

	const {
		to,
		setTo,
		cc,
		setCc,
		bcc,
		setBcc,
		showCcBcc,
		setShowCcBcc,
		subject,
		setSubject,
		body,
		setBody,
		error,
		isSavingDraft,
		isSending,
		formTitle,
		sendAsName,
		sendAsEmail,
		handleSaveDraft,
		handleSend,
		closeCompose,
		closePanel,
		attachments,
		handleAddAttachments,
		handleRemoveAttachment,
	} = useComposeForm(mailboxId, folder);

	return (
		<div className="flex flex-col h-full bg-kumo-base">
			<div className="flex items-center justify-between px-4 py-3 border-b border-kumo-line shrink-0 md:px-6">
				<h2 className="text-base font-semibold text-kumo-default">
					{formTitle}
				</h2>
				<div className="flex items-center gap-1">
					<Button
						variant="ghost"
						shape="square"
						size="sm"
						icon={<XIcon size={18} />}
						onClick={closeCompose}
						disabled={isSending}
						aria-label="关闭写信"
					/>
				</div>
			</div>

			<form
				onSubmit={(e) => handleSend(e, closePanel)}
				className="flex flex-col flex-1 min-h-0 overflow-y-auto"
			>
				<div className="p-4 md:p-6 space-y-4">
					{error && <Banner variant="error" text={error} />}
					{sendAsEmail && (
						<div className="text-sm text-kumo-subtle">
							发件人：{sendAsName && sendAsName !== sendAsEmail ? `${sendAsName} <${sendAsEmail}>` : sendAsEmail}
						</div>
					)}

					<div className="space-y-3">
						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
								收件人
							</label>
							<div className="flex-1 flex items-center gap-2 min-w-0">
								<Input
									type="text"
									placeholder="recipient@example.com"
									size="sm"
									value={to}
									onChange={(e) => setTo(e.target.value)}
									required
								/>
								{!showCcBcc && (
									<button
										type="button"
										onClick={() => setShowCcBcc(true)}
										className="shrink-0 text-xs text-kumo-link hover:text-kumo-link-hover font-medium"
									>
										CC / BCC
									</button>
								)}
							</div>
						</div>

						{showCcBcc && (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									抄送
								</label>
								<div className="flex-1">
									<Input
										type="text"
										size="sm"
										value={cc}
										onChange={(e) => setCc(e.target.value)}
										placeholder="多个地址用逗号分隔"
									/>
								</div>
							</div>
						)}

						{showCcBcc && (
							<div className="flex items-center gap-2">
								<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
									密送
								</label>
								<div className="flex-1">
									<Input
										type="text"
										size="sm"
										value={bcc}
										onChange={(e) => setBcc(e.target.value)}
										placeholder="多个地址用逗号分隔"
									/>
								</div>
							</div>
						)}

						<div className="flex items-center gap-2">
							<label className="text-sm font-medium text-kumo-subtle w-14 shrink-0">
								主题
							</label>
							<div className="flex-1">
								<Input
									type="text"
									placeholder="邮件主题"
									size="sm"
									value={subject}
									onChange={(e) => setSubject(e.target.value)}
									required
								/>
							</div>
						</div>
					</div>

					<div className="border border-kumo-line rounded-md overflow-hidden bg-kumo-base">
						<RichTextEditor
							value={body}
							onChange={setBody}
						/>
					</div>

					<div>
						<input
							ref={fileInputRef}
							type="file"
							multiple
							onChange={(e) => {
								handleAddAttachments(e.target.files);
								if (fileInputRef.current) fileInputRef.current.value = "";
							}}
							className="hidden"
						/>
						<Button
							type="button"
							variant="ghost"
							size="sm"
							icon={<PaperclipIcon size={14} />}
							onClick={() => fileInputRef.current?.click()}
							disabled={isSending}
						>
							添加附件
						</Button>
						{attachments.length > 0 && (
							<div className="mt-3 space-y-2">
								<div className="text-sm font-medium text-kumo-default">
									附件 ({attachments.length})
								</div>
								<div className="space-y-1">
									{attachments.map((att) => (
										<div
											key={att.id}
											className="flex items-center justify-between gap-2 rounded-md border border-kumo-line px-3 py-2 bg-kumo-fill/30"
										>
											<div className="flex items-center gap-2 flex-1 min-w-0">
												<PaperclipIcon size={14} className="text-kumo-subtle shrink-0" />
												<span className="text-sm text-kumo-default font-medium truncate">
													{att.filename}
												</span>
												<span className="text-xs text-kumo-subtle shrink-0">
													{formatBytes(att.size)}
												</span>
											</div>
											<button
												type="button"
												onClick={() => handleRemoveAttachment(att.id)}
												className="text-kumo-subtle hover:text-kumo-error transition-colors"
												disabled={isSending}
											>
												<XIcon size={16} />
											</button>
										</div>
									))}
								</div>
							</div>
						)}
					</div>
				</div>

				{/* Footer actions */}
				<div className="mt-auto px-4 py-3 border-t border-kumo-line bg-kumo-fill/30 shrink-0 md:px-6">
					<div className="flex items-center justify-between">
						<Button type="button" variant="ghost" size="sm" onClick={closeCompose} disabled={isSending}>
							丢弃
						</Button>
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="secondary"
								size="sm"
								loading={isSavingDraft}
								disabled={isSending}
								icon={<FloppyDiskIcon size={14} />}
								onClick={handleSaveDraft}
							>
								{isSavingDraft ? "保存中…" : "存草稿"}
							</Button>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isSending}
								disabled={isSavingDraft || isSending}
								icon={<PaperPlaneTiltIcon size={14} />}
							>
								{isSending ? "发送中…" : "发送"}
							</Button>
						</div>
					</div>
				</div>
			</form>
		</div>
	);
}
