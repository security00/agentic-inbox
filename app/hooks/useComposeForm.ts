// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useKumoToastManager } from "@cloudflare/kumo";
import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
	buildQuotedReplyBlock,
	escapeHtml,
	formatComposeDate,
	getSignatureBlock,
	htmlToPlainText,
	splitEmailList,
	stripHtml,
	toEmailListValue,
} from "~/lib/utils";
import { useDeleteEmail, useForwardEmail, useReplyToEmail, useSaveDraft, useSendEmail } from "~/queries/emails";
import { useMailbox } from "~/queries/mailboxes";
import { useSignatureTemplate } from "~/queries/settings";
import { useUIStore } from "~/hooks/useUIStore";

interface ComposeAttachment {
	id: string;
	file: File;
	dataUrl: string;
	isImage: boolean;
	insertedInline: boolean;
}

function appendUniqueAddress(
	addresses: string[],
	seen: Set<string>,
	address: string,
	exclude?: string,
) {
	const trimmed = address.trim();
	if (!trimmed) return;

	const normalized = trimmed.toLowerCase();
	if (normalized === exclude || seen.has(normalized)) return;

	seen.add(normalized);
	addresses.push(trimmed);
}

interface ComposeFormFields {
	to: string;
	cc: string;
	bcc: string;
	showCcBcc: boolean;
	subject: string;
	body: string;
}

const EMPTY_FIELDS: ComposeFormFields = {
	to: "",
	cc: "",
	bcc: "",
	showCcBcc: false,
	subject: "",
	body: "",
};

function getPrefixedSubject(subject: string, prefix: "Re" | "Fwd") {
	const expectedPrefix = `${prefix}: `;
	return subject.startsWith(expectedPrefix)
		? subject
		: `${expectedPrefix}${subject}`;
}

function buildForwardBody(
	original: NonNullable<ReturnType<typeof useUIStore.getState>["composeOptions"]["originalEmail"]>,
	sigBlock: string,
) {
	const safeSender = escapeHtml(original.sender);
	const safeSubject = escapeHtml(original.subject);
	const safeBody = escapeHtml(stripHtml(original.body || "")).replace(/\n/g, "<br>");

	return `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ""}<div style="border: 1px solid #ddd; padding: 1em; background-color: #f9f9f9; margin: 1em 0;"><strong>Forwarded message:</strong><br><strong>From:</strong> ${safeSender}<br><strong>Date:</strong> ${formatComposeDate(original.date)}<br><strong>Subject:</strong> ${safeSubject}<br><br>${safeBody}</div>`;
}

function buildReplyAllFields(
	original: NonNullable<ReturnType<typeof useUIStore.getState>["composeOptions"]["originalEmail"]>,
	selfAddress?: string,
) {
	const toRecipients: string[] = [];
	const toSeen = new Set<string>();
	appendUniqueAddress(toRecipients, toSeen, original.sender, selfAddress);

	for (const recipient of splitEmailList(original.recipient)) {
		appendUniqueAddress(toRecipients, toSeen, recipient, selfAddress);
	}

	const ccRecipients: string[] = [];
	const ccSeen = new Set<string>();
	for (const recipient of splitEmailList(original.cc)) {
		const normalized = recipient.toLowerCase();
		if (
			normalized === selfAddress ||
			toSeen.has(normalized) ||
			ccSeen.has(normalized)
		) {
			continue;
		}
		ccSeen.add(normalized);
		ccRecipients.push(recipient);
	}

	return {
		to: toRecipients.join(", "),
		cc: ccRecipients.join(", "),
		showCcBcc: ccRecipients.length > 0,
	};
}

function buildInitialComposeFields(
	composeOptions: ReturnType<typeof useUIStore.getState>["composeOptions"],
	mailboxEmail: string | undefined,
	sigBlock: string,
): ComposeFormFields {
	const { draftEmail: draft, originalEmail: original, mode } = composeOptions;

	if (draft) {
		return {
			to: draft.recipient || "",
			cc: draft.cc || "",
			bcc: draft.bcc || "",
			showCcBcc: Boolean(draft.cc || draft.bcc),
			subject: draft.subject || "",
			body: draft.body || "",
		};
	}

	if (!original) {
		return {
			...EMPTY_FIELDS,
			body: sigBlock ? `<p><br></p>${sigBlock}` : "",
		};
	}

	if (mode === "reply") {
		return {
			...EMPTY_FIELDS,
			to: original.sender,
			subject: getPrefixedSubject(original.subject, "Re"),
			body: `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ""}${buildQuotedReplyBlock(original.date, original.sender, original.body || "")}`,
		};
	}

	if (mode === "reply-all") {
		const recipients = buildReplyAllFields(original, mailboxEmail?.toLowerCase());
		return {
			...EMPTY_FIELDS,
			...recipients,
			subject: getPrefixedSubject(original.subject, "Re"),
			body: `<p><br></p>${sigBlock ? `${sigBlock}<br>` : ""}${buildQuotedReplyBlock(original.date, original.sender, original.body || "")}`,
		};
	}

	if (mode === "forward") {
		return {
			...EMPTY_FIELDS,
			subject: getPrefixedSubject(original.subject, "Fwd"),
			body: buildForwardBody(original, sigBlock),
		};
	}

	return {
		...EMPTY_FIELDS,
		body: sigBlock ? `<p><br></p>${sigBlock}` : "",
	};
}

export function useComposeForm(mailboxId?: string, _folder?: string) {
	const toastManager = useKumoToastManager();
	const { composeOptions, closePanel, closeCompose } = useUIStore();
	const { data: currentMailbox } = useMailbox(mailboxId);
	const { data: signatureTemplate, isFetched: templateFetched } = useSignatureTemplate();
	const sendEmailMutation = useSendEmail();
	const saveDraftMutation = useSaveDraft();
	const replyMutation = useReplyToEmail();
	const forwardMutation = useForwardEmail();
	const deleteEmailMutation = useDeleteEmail();

	const [to, setTo] = useState("");
	const [cc, setCc] = useState("");
	const [bcc, setBcc] = useState("");
	const [showCcBcc, setShowCcBcc] = useState(false);
	const [subject, setSubject] = useState("");
	const [body, setBody] = useState("");
	const [attachments, setAttachments] = useState<ComposeAttachment[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [isSavingDraft, setIsSavingDraft] = useState(false);
	const [isSending, setIsSending] = useState(false);
	const lastInitializedOptionsRef = useRef<typeof composeOptions | null>(null);
	const isDraftEdit = !!composeOptions.draftEmail;
	const editorInsertImageRef = useRef<((src: string, alt?: string) => void) | null>(null);

	const formTitle = useMemo(() => {
		if (isDraftEdit) return "编辑草稿";
		switch (composeOptions.mode) { case "reply": return "回复"; case "reply-all": return "回复全部"; case "forward": return "转发"; default: return "新邮件"; }
	}, [composeOptions.mode, isDraftEdit]);

	const sigBlock = useMemo(
		() => getSignatureBlock(currentMailbox?.settings, signatureTemplate, currentMailbox),
		[currentMailbox, signatureTemplate],
	);

	useEffect(() => {
		if (!templateFetched) return;
		if (lastInitializedOptionsRef.current === composeOptions) return;
		lastInitializedOptionsRef.current = composeOptions;

		const initialFields = buildInitialComposeFields(
			composeOptions,
			currentMailbox?.email,
			sigBlock,
		);
		setError(null);
		setTo(initialFields.to);
		setCc(initialFields.cc);
		setBcc(initialFields.bcc);
		setShowCcBcc(initialFields.showCcBcc);
		setSubject(initialFields.subject);
		setBody(initialFields.body);
	}, [composeOptions, currentMailbox?.email, sigBlock, templateFetched]);

	const handleAddAttachments = useCallback(async (files: File[]) => {
		const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
		const MAX_TOTAL_SIZE = 20 * 1024 * 1024; // 20MB
		const MAX_FILES = 10;

		const currentTotalSize = attachments.reduce((sum, att) => sum + att.file.size, 0);
		
		if (attachments.length + files.length > MAX_FILES) {
			toastManager.add({ title: `最多只能添加 ${MAX_FILES} 个附件`, variant: "error" });
			return;
		}

		const newAttachments: ComposeAttachment[] = [];
		let newTotalSize = currentTotalSize;

		for (const file of files) {
			if (file.size > MAX_FILE_SIZE) {
				toastManager.add({ title: `文件 "${file.name}" 超过 10MB 限制`, variant: "error" });
				continue;
			}

			if (newTotalSize + file.size > MAX_TOTAL_SIZE) {
				toastManager.add({ title: "附件总大小不能超过 20MB", variant: "error" });
				break;
			}

			const isImage = file.type.startsWith("image/");
			const reader = new FileReader();
			
			await new Promise<void>((resolve) => {
				reader.onload = () => {
					const dataUrl = reader.result as string;
					const id = `att-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
					
					newAttachments.push({
						id,
						file,
						dataUrl,
						isImage,
						insertedInline: false,
					});
					
					newTotalSize += file.size;
					
					// For images, insert into editor
					if (isImage && editorInsertImageRef.current) {
						editorInsertImageRef.current(dataUrl, file.name);
						newAttachments[newAttachments.length - 1].insertedInline = true;
					}
					
					resolve();
				};
				reader.readAsDataURL(file);
			});
		}

		if (newAttachments.length > 0) {
			setAttachments(prev => [...prev, ...newAttachments]);
		}
	}, [attachments, toastManager]);

	const handleRemoveAttachment = useCallback((id: string) => {
		setAttachments(prev => prev.filter(att => att.id !== id));
	}, []);

	const setEditorInsertImage = useCallback((fn: (src: string, alt?: string) => void) => {
		editorInsertImageRef.current = fn;
	}, []);

	const handleSaveDraft = async () => {
		if (!mailboxId || isSending) return; setIsSavingDraft(true); setError(null);
		try {
			await saveDraftMutation.mutateAsync({ mailboxId, draft: {
				to,
				cc: cc || undefined,
				bcc: bcc || undefined,
				subject,
				body,
				in_reply_to: composeOptions.originalEmail?.id || composeOptions.draftEmail?.in_reply_to || undefined,
				thread_id: composeOptions.originalEmail?.thread_id || composeOptions.draftEmail?.thread_id || undefined,
				draft_id: composeOptions.draftEmail?.id || undefined,
			} });
			toastManager.add({ title: "草稿已保存" });
		}
		catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "保存草稿失败。";
			setError(message);
			toastManager.add({ title: message, variant: "error" });
		}
		finally { setIsSavingDraft(false); }
	};

	const handleSend = async (e: FormEvent, onClose: () => void) => {
		e.preventDefault(); if (isSending) return; setError(null);
		if (!currentMailbox || !mailboxId) { setError("未选择邮箱。"); return; }
		const toRecipients = splitEmailList(to);
		if (toRecipients.length === 0) { setError("请至少填写一位收件人。"); return; }
		const ccRecipients = splitEmailList(cc); const bccRecipients = splitEmailList(bcc);
		const fromName = currentMailbox.settings?.fromName || currentMailbox.name;
		const from = fromName && fromName !== currentMailbox.email ? { email: currentMailbox.email, name: fromName } : currentMailbox.email;
		
		// Process inline images: convert data URLs to CID references
		let processedHtml = body;
		const emailAttachments: {
			content: string;
			filename: string;
			type: string;
			disposition: "attachment" | "inline";
			contentId?: string;
		}[] = [];

		// Create a map of data URLs to content IDs for inline images
		const dataUrlToCid = new Map<string, string>();
		
		for (const att of attachments) {
			const base64Content = att.dataUrl.split(',')[1];
			
			if (att.isImage && att.insertedInline) {
				// Generate a content ID for inline images
				const contentId = `img-${att.id}`;
				dataUrlToCid.set(att.dataUrl, contentId);
				
				emailAttachments.push({
					content: base64Content,
					filename: att.file.name,
					type: att.file.type,
					disposition: "inline",
					contentId,
				});
			} else {
				// Regular attachments
				emailAttachments.push({
					content: base64Content,
					filename: att.file.name,
					type: att.file.type,
					disposition: "attachment",
				});
			}
		}

		// Replace data URLs with CID references in the HTML
		for (const [dataUrl, contentId] of dataUrlToCid.entries()) {
			const escapedDataUrl = dataUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
			processedHtml = processedHtml.replace(
				new RegExp(`src="${escapedDataUrl}"`, 'g'),
				`src="cid:${contentId}"`
			);
		}
		
		const emailData = {
			to: toEmailListValue(toRecipients),
			cc: toEmailListValue(ccRecipients),
			bcc: toEmailListValue(bccRecipients),
			from,
			subject,
			html: processedHtml,
			text: htmlToPlainText(processedHtml),
			...(emailAttachments.length > 0 ? { attachments: emailAttachments } : {}),
		};
		const draftId = composeOptions.draftEmail?.id; const mode = composeOptions.mode; const originalId = composeOptions.originalEmail?.id || composeOptions.draftEmail?.in_reply_to;
		setIsSending(true); toastManager.add({ title: "正在发送…" });
		try {
			if ((mode === "reply" || mode === "reply-all") && originalId) await replyMutation.mutateAsync({ mailboxId, emailId: originalId, email: emailData });
			else if (mode === "forward" && originalId) await forwardMutation.mutateAsync({ mailboxId, emailId: originalId, email: emailData });
			else await sendEmailMutation.mutateAsync({ mailboxId, email: emailData });
			if (draftId) deleteEmailMutation.mutate({ mailboxId, id: draftId });
			toastManager.add({ title: "邮件已发送" });
			onClose();
		} catch (err: unknown) { const message = (err instanceof Error ? err.message : null) || "发送失败。"; setError(message); toastManager.add({ title: message, variant: "error" }); }
		finally { setIsSending(false); }
	};

	const sendAsName = currentMailbox?.settings?.fromName || currentMailbox?.name || "";
	const sendAsEmail = currentMailbox?.email || mailboxId || "";

	return { to, setTo, cc, setCc, bcc, setBcc, showCcBcc, setShowCcBcc, subject, setSubject, body, setBody, attachments, handleAddAttachments, handleRemoveAttachment, setEditorInsertImage, error, setError, isSavingDraft, isSending, formTitle, sendAsName, sendAsEmail, handleSaveDraft, handleSend, closeCompose, closePanel };
}
