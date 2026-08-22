// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Input } from "@cloudflare/kumo";
import { FloppyDiskIcon, PaperPlaneTiltIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import React, { useRef } from "react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import RichTextEditor, { type RichTextEditorRef } from "./RichTextEditor";
import { formatBytes } from "~/lib/utils";

export default function ComposePanel() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();

	const fileInputRef = useRef<HTMLInputElement>(null);
	const editorRef = useRef<RichTextEditorRef>(null);

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
		attachments,
		handleAddAttachments,
		handleRemoveAttachment,
		setEditorInsertImage,
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
	} = useComposeForm(mailboxId, folder);

	// Connect editor to form once it's ready
	React.useEffect(() => {
		if (editorRef.current && !isSending) {
			setEditorInsertImage(editorRef.current.insertImage);
		}
	}, [setEditorInsertImage, isSending]);

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
							ref={editorRef}
							value={body}
							onChange={setBody}
							onImagePaste={async (file) => {
								await handleAddAttachments([file]);
							}}
						/>
					</div>

					{/* Attachments */}
					{attachments.length > 0 && (
						<div className="space-y-2">
							<div className="text-sm font-medium text-kumo-default">附件</div>
							<div className="flex flex-wrap gap-2">
								{attachments.map((att) => (
									<div
										key={att.id}
										className="flex items-center gap-2 px-3 py-2 bg-kumo-tint rounded-md border border-kumo-line text-xs"
									>
										<span className="text-kumo-default truncate max-w-[200px]">
											{att.file.name}
											{att.insertedInline && att.isImage && (
												<span className="ml-1 text-kumo-subtle">(正文图片)</span>
											)}
										</span>
										<span className="text-kumo-subtle shrink-0">
											{formatBytes(att.file.size)}
										</span>
										<button
											type="button"
											onClick={() => handleRemoveAttachment(att.id)}
											className="ml-1 text-kumo-subtle hover:text-kumo-default"
											aria-label="移除附件"
										>
											<XIcon size={14} />
										</button>
									</div>
								))}
							</div>
						</div>
					)}

					<input
						ref={fileInputRef}
						type="file"
						multiple
						accept="*/*"
						className="hidden"
						onChange={(e) => {
							const files = Array.from(e.target.files || []);
							if (files.length > 0) {
								handleAddAttachments(files);
							}
							if (fileInputRef.current) {
								fileInputRef.current.value = '';
							}
						}}
					/>
				</div>

				{/* Footer actions */}
				<div className="mt-auto px-4 py-3 border-t border-kumo-line bg-kumo-fill/30 shrink-0 md:px-6">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<Button type="button" variant="ghost" size="sm" onClick={closeCompose} disabled={isSending}>
								丢弃
							</Button>
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
						</div>
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
