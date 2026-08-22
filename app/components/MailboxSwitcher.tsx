// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Input } from "@cloudflare/kumo";
import { CaretDownIcon, CheckIcon } from "@phosphor-icons/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { useMailboxes, useUnreadSummary } from "~/queries/mailboxes";
import { useUIStore } from "~/hooks/useUIStore";
import type { Mailbox } from "~/types";

function mailboxLabel(mailbox: Mailbox) {
	const fromName = mailbox.settings?.fromName?.trim();
	if (fromName && fromName !== mailbox.email) return fromName;
	const name = mailbox.name?.trim();
	if (name && name !== mailbox.email) return name;
	const domain = mailbox.email.split("@")[1];
	return domain || mailbox.email;
}

function pathForMailbox(id: string, folder: string | undefined, pathname: string) {
	if (pathname.includes("/settings")) return `/mailbox/${id}/settings`;
	if (pathname.includes("/search") || !folder) return `/mailbox/${id}/emails/inbox`;
	return `/mailbox/${id}/emails/${folder}`;
}

interface MailboxSwitcherProps {
	currentId?: string;
	displayName: string;
	emailAddress: string;
}

export default function MailboxSwitcher({
	currentId,
	displayName,
	emailAddress,
}: MailboxSwitcherProps) {
	const { folder } = useParams<{ folder?: string }>();
	const location = useLocation();
	const navigate = useNavigate();
	const { closeSidebar } = useUIStore();
	const { data: mailboxes = [] } = useMailboxes();
	const { data: unreadSummary = [] } = useUnreadSummary();
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");
	const rootRef = useRef<HTMLDivElement>(null);

	const unreadByMailbox = useMemo(() => {
		const map = new Map<string, number>();
		for (const item of unreadSummary) {
			map.set(item.mailboxId.toLowerCase(), item.unreadCount);
		}
		return map;
	}, [unreadSummary]);

	const filtered = useMemo(() => {
		const q = query.trim().toLowerCase();
		const list = [...mailboxes].sort((a, b) => {
			// Sort mailboxes with unread first, then alphabetically
			const aUnread = unreadByMailbox.get(a.email.toLowerCase()) || 0;
			const bUnread = unreadByMailbox.get(b.email.toLowerCase()) || 0;
			if (aUnread > 0 && bUnread === 0) return -1;
			if (aUnread === 0 && bUnread > 0) return 1;
			return a.email.localeCompare(b.email);
		});
		if (!q) return list;
		return list.filter((m) => {
			const label = mailboxLabel(m).toLowerCase();
			return m.email.toLowerCase().includes(q) || label.includes(q);
		});
	}, [mailboxes, query, unreadByMailbox]);

	useEffect(() => {
		if (!open) return;
		const onDoc = (e: MouseEvent) => {
			if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
		};
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") setOpen(false);
		};
		document.addEventListener("mousedown", onDoc);
		document.addEventListener("keydown", onKey);
		return () => {
			document.removeEventListener("mousedown", onDoc);
			document.removeEventListener("keydown", onKey);
		};
	}, [open]);

	const switchTo = (id: string) => {
		setOpen(false);
		setQuery("");
		closeSidebar();
		if (id === currentId) return;
		navigate(pathForMailbox(id, folder, location.pathname));
	};

	return (
		<div ref={rootRef} className="relative">
			<button
				type="button"
				aria-haspopup="listbox"
				aria-expanded={open}
				onClick={() => setOpen((v) => !v)}
				className="w-full text-left rounded-md px-1 py-1 -mx-0 hover:bg-kumo-tint transition-colors cursor-pointer bg-transparent border-0"
			>
				<div className="flex items-start gap-1">
					<div className="min-w-0 flex-1">
						<div className="text-sm font-semibold text-kumo-default break-all leading-snug">
							{displayName}
						</div>
						<div className="text-xs text-kumo-subtle break-all mt-0.5 leading-snug">
							{emailAddress}
						</div>
					</div>
					<CaretDownIcon
						size={14}
						className={`mt-1 shrink-0 text-kumo-subtle transition-transform ${open ? "rotate-180" : ""}`}
					/>
				</div>
			</button>
			{open && (
				<div className="absolute left-0 right-0 z-50 mt-1 rounded-lg border border-kumo-line bg-kumo-base shadow-lg overflow-hidden">
					<div className="p-2 border-b border-kumo-line">
						<Input
							aria-label="筛选邮箱"
							placeholder="筛选邮箱…"
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							autoFocus
						/>
					</div>
					<div className="max-h-64 overflow-y-auto py-1" role="listbox">
						{filtered.length === 0 ? (
							<div className="px-3 py-4 text-xs text-kumo-subtle">没有匹配的邮箱</div>
						) : (
							filtered.map((m) => {
								const active = m.id === currentId || m.email === currentId;
								const unreadCount = unreadByMailbox.get(m.email.toLowerCase()) || 0;
								return (
									<button
										key={m.id}
										type="button"
										role="option"
										aria-selected={active}
										onClick={() => switchTo(m.id)}
										className={`w-full text-left px-3 py-2 flex items-start gap-2 cursor-pointer border-0 bg-transparent ${
											active ? "bg-kumo-fill" : "hover:bg-kumo-tint"
										}`}
									>
										<div className="min-w-0 flex-1">
											<div className="text-sm text-kumo-default truncate flex items-center gap-2">
												{mailboxLabel(m)}
												{unreadCount > 0 && (
													<span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-orange-500 text-[10px] font-bold text-white">
														{unreadCount > 99 ? "99+" : unreadCount}
													</span>
												)}
											</div>
											<div className="text-xs text-kumo-subtle truncate">
												{m.email}
											</div>
										</div>
										{active && (
											<CheckIcon size={14} className="mt-1 shrink-0 text-kumo-default" />
										)}
									</button>
								);
							})
						)}
					</div>
				</div>
			)}
		</div>
	);
}
