// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Banner, Button, Dialog, Input, Text } from "@cloudflare/kumo";
import { FloppyDiskIcon, PaperPlaneTiltIcon, PaperclipIcon, XIcon } from "@phosphor-icons/react";
import { useParams } from "react-router";
import { useComposeForm } from "~/hooks/useComposeForm";
import RichTextEditor, { type RichTextEditorRef } from "./RichTextEditor";
import { useUIStore } from "~/hooks/useUIStore";
import { formatBytes } from "~/lib/utils";
import { useRef } from "react";

export default function ComposeEmail() {
	const { mailboxId, folder } = useParams<{
		mailboxId: string;
		folder: string;
	}>();
	
	const { isComposeModalOpen, closeComposeModal } = useUIStore();

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
	} = useComposeForm(mailboxId, folder);

	// Connect editor to form
	if (editorRef.current && !isSending) {
		setEditorInsertImage(editorRef.current.insertImage);
	}

	return (
		<Dialog.Root
			open={isComposeModalOpen}
			onOpenChange={(open) => !open && !isSending && closeComposeModal()}
		>
			<Dialog size="lg" className="p-6 max-h-[85vh] overflow-y-auto">
				<Dialog.Title className="text-lg font-semibold mb-5">
					{formTitle}
				</Dialog.Title>
				<form onSubmit={(e) => handleSend(e, closeComposeModal)} className="space-y-4">
					{error && <Banner variant="error" text={error} />}
					{sendAsEmail && (
						<div className="text-sm text-kumo-subtle">
							发件人：{sendAsName && sendAsName !== sendAsEmail ? `${sendAsName} <${sendAsEmail}>` : sendAsEmail}
						</div>
					)}
					<div className="flex items-center gap-2">
						<div className="flex-1">
							<Input
								label="收件人"
								type="text"
								placeholder="recipient@example.com, another@example.com"
								size="sm"
								value={to}
								onChange={(e) => setTo(e.target.value)}
								required
							/>
						</div>
						{!showCcBcc && (
							<button
								type="button"
								onClick={() => setShowCcBcc(true)}
								className="shrink-0 text-xs text-kumo-link hover:text-kumo-link-hover font-medium mt-5"
							>
								CC / BCC
							</button>
						)}
					</div>
					{showCcBcc && (
						<Input
							label="CC"
							type="text"
							size="sm"
							value={cc}
							onChange={(e) => setCc(e.target.value)}
							placeholder="多个地址用逗号分隔"
						/>
					)}
					{showCcBcc && (
						<Input
							label="BCC"
							type="text"
							size="sm"
							value={bcc}
							onChange={(e) => setBcc(e.target.value)}
							placeholder="多个地址用逗号分隔"
						/>
					)}
					<Input
						label="主题"
						type="text"
						placeholder="邮件主题"
						size="sm"
						value={subject}
						onChange={(e) => setSubject(e.target.value)}
						required
					/>
					<div>
						<Text size="sm" DANGEROUS_className="font-medium mb-1.5 block">
							正文
						</Text>
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
							<Text size="sm" DANGEROUS_className="font-medium">
								附件
							</Text>
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

					<div className="flex justify-between items-center pt-2">
						<div className="flex items-center gap-2">
							<Button
								type="button"
								variant="ghost"
								size="sm"
								onClick={closeComposeModal}
								disabled={isSending}
							>
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
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
