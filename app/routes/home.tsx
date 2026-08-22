// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Select,
	Text,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeIcon, GlobeIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { useAddDomain, useSignatureTemplate, useUpdateSignatureTemplate } from "~/queries/settings";
import { queryKeys } from "~/queries/keys";
import type { Mailbox } from "~/types";
import {
	DEFAULT_SIGNATURE_TEMPLATE_TEXT,
	renderSignatureTemplate,
} from "shared/signature-template";


const PREFERRED_MAILBOX = "support@discoverkeywords.co";

function mailboxTitle(email: string, mailbox?: Mailbox) {
	const fromName = mailbox?.settings?.fromName?.trim();
	if (fromName && fromName !== email) return fromName;
	const name = mailbox?.name?.trim();
	if (name && name !== email) return name;
	return email.split("@")[0] || email;
}

export function meta() {
	return [{ title: "Discover Keywords 邮箱" }];
}

export default function HomeRoute() {
	const toastManager = useKumoToastManager();
	const { data: mailboxes = [], refetch: refetchMailboxes, isFetched: mailboxesFetched } = useMailboxes();
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newPrefix, setNewPrefix] = useState("");
	const [selectedDomain, setSelectedDomain] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [mailboxToDelete, setMailboxToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);
	const [filterQuery, setFilterQuery] = useState("");
	const [lastMailboxId, setLastMailboxId] = useState<string | null>(null);

	const { data: signatureTemplate } = useSignatureTemplate();
	const updateSignatureTemplate = useUpdateSignatureTemplate();
	const [tplEnabled, setTplEnabled] = useState(false);
	const [tplText, setTplText] = useState(DEFAULT_SIGNATURE_TEMPLATE_TEXT);
	const [isSavingTpl, setIsSavingTpl] = useState(false);
	const addDomain = useAddDomain();
	const [isConnectOpen, setIsConnectOpen] = useState(false);
	const [newDomain, setNewDomain] = useState("");
	const [connectError, setConnectError] = useState<string | null>(null);
	const [isConnecting, setIsConnecting] = useState(false);
	const [connectDone, setConnectDone] = useState(false);

	useEffect(() => {
		if (!signatureTemplate) return;
		setTplEnabled(signatureTemplate.enabled);
		setTplText(signatureTemplate.text || DEFAULT_SIGNATURE_TEMPLATE_TEXT);
	}, [signatureTemplate]);

	useEffect(() => {
		try {
			setLastMailboxId(localStorage.getItem("inbox:lastMailboxId"));
		} catch {
			// ignore
		}
	}, []);

	// Set default domain when config loads
	useEffect(() => {
		if (domains.length > 0 && !selectedDomain) {
			setSelectedDomain(domains[0]);
		}
	}, [domains, selectedDomain]);

	// Auto-create mailboxes from config (run once when both data sources are ready)
	const autoCreateDone = useRef(false);
	useEffect(() => {
		if (autoCreateDone.current) return;
		if (emailAddresses.length === 0 || !mailboxesFetched) return;
		const existingEmails = new Set(
			mailboxes.map((m) => m.email.toLowerCase()),
		);
		const toCreate = emailAddresses.filter(
			(addr) => !existingEmails.has(addr.toLowerCase()),
		);
		if (toCreate.length === 0) {
			autoCreateDone.current = true;
			return;
		}
		autoCreateDone.current = true;
		let cancelled = false;
		Promise.all(
			toCreate.map((addr) => {
				const localPart = addr.split("@")[0] || addr;
				return api.createMailbox(addr, localPart).catch(() => {});
			}),
		).then(() => { if (!cancelled) refetchMailboxes(); });
		return () => { cancelled = true; };
	}, [emailAddresses, mailboxes, refetchMailboxes]);

	const handleConnect = async (e: FormEvent) => {
		e.preventDefault();
		setConnectError(null);
		const domain = newDomain.trim();
		if (!domain) {
			setConnectError("请填写域名");
			return;
		}
		setIsConnecting(true);
		try {
			const result = await addDomain.mutateAsync(domain);
			const next = (result.domains || []).find((d) =>
				d === domain.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, ""),
			) || result.domains?.[result.domains.length - 1] || domain.toLowerCase();
			setSelectedDomain(next);
			setConnectDone(true);
			toastManager.add({ title: "域名已接入" });
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "接入失败";
			setConnectError(message);
		} finally {
			setIsConnecting(false);
		}
	};

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		if (!newPrefix || !selectedDomain) {
			setCreateError("请填写全部字段");
			return;
		}
		const email = `${newPrefix}@${selectedDomain}`;
		const name = newName || newPrefix;
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name });
			toastManager.add({ title: "邮箱已创建" });
			setIsCreateOpen(false);
			setNewPrefix("");
			setNewName("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "创建邮箱失败";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async () => {
		if (!mailboxToDelete) return;
		setIsDeleting(true);
		try {
			await deleteMailbox.mutateAsync(mailboxToDelete.id);
			toastManager.add({ title: "邮箱已删除" });
			setIsDeleteOpen(false);
			setMailboxToDelete(null);
		} catch {
			toastManager.add({ title: "删除邮箱失败", variant: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const isConfigured = emailAddresses.length > 0;
	const mailboxByEmail = useMemo(() => {
		const map = new Map<string, Mailbox>();
		for (const mailbox of mailboxes) {
			map.set(mailbox.email.toLowerCase(), mailbox);
		}
		return map;
	}, [mailboxes]);

	const accounts = useMemo(() => {
		const raw = mailboxes.map((mailbox) => ({
			id: mailbox.id,
			email: mailbox.email,
			name: mailboxTitle(mailbox.email, mailbox),
		}));
		const preferred = PREFERRED_MAILBOX.toLowerCase();
		const last = lastMailboxId?.toLowerCase() || "";
		return [...raw].sort((a, b) => {
			const ae = a.email.toLowerCase();
			const be = b.email.toLowerCase();
			const rank = (email: string) => {
				if (email === preferred && last === preferred) return 0;
				if (email === preferred) return 1;
				if (last && (email === last || email.startsWith(last))) return 2;
				return 3;
			};
			const diff = rank(ae) - rank(be);
			if (diff !== 0) return diff;
			return ae.localeCompare(be);
		});
	}, [mailboxes, lastMailboxId]);

	const visibleAccounts = useMemo(() => {
		const q = filterQuery.trim().toLowerCase();
		if (!q) return accounts;
		return accounts.filter(
			(account) =>
				account.email.toLowerCase().includes(q) ||
				account.name.toLowerCase().includes(q),
		);
	}, [accounts, filterQuery]);

	const previewEmail =
		accounts.find((a) => a.email.toLowerCase() === PREFERRED_MAILBOX.toLowerCase())?.email
		|| accounts[0]?.email
		|| PREFERRED_MAILBOX;
	const previewMailbox = mailboxByEmail.get(previewEmail.toLowerCase());
	const previewFromName = mailboxTitle(previewEmail, previewMailbox);
	const previewSignature = renderSignatureTemplate(tplText, {
		email: previewEmail,
		fromName: previewFromName,
		name: previewFromName,
	});

	const handleSaveTemplate = async () => {
		setIsSavingTpl(true);
		try {
			await updateSignatureTemplate.mutateAsync({ enabled: tplEnabled, text: tplText });
			toastManager.add({ title: "默认签名模板已保存" });
		} catch {
			toastManager.add({ title: "保存签名模板失败", variant: "error" });
		} finally {
			setIsSavingTpl(false);
		}
	};

	const isLoading = !configData;

	return (
		<div className="min-h-full bg-kumo-recessed overflow-y-auto">
			<div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
				<div className="mb-8">
					<div className="flex items-center justify-between gap-3">
						<h1 className="text-2xl font-bold text-kumo-default">邮箱</h1>
						<div className="flex items-center gap-2">
							<Button
								variant="secondary"
								icon={<GlobeIcon size={16} />}
								onClick={() => {
									setConnectError(null);
									setConnectDone(false);
									setIsConnectOpen(true);
								}}
							>
								接入域名
							</Button>
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								新建邮箱
							</Button>
						</div>
					</div>
					{domains.length > 0 && (
						<p className="text-sm text-kumo-subtle mt-1">
							已接入 {domains.length} 个域名
						</p>
					)}
				</div>

				{!isLoading && accounts.length > 0 && (
					<div className="mb-4">
						<Input
							aria-label="筛选邮箱"
							placeholder="筛选邮箱…"
							value={filterQuery}
							onChange={(e) => setFilterQuery(e.target.value)}
						/>
					</div>
				)}

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : visibleAccounts.length > 0 ? (
					<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden">
						{visibleAccounts.map((account, idx) => {
							const mailbox = mailboxByEmail.get(account.email.toLowerCase());
							const unreadCount = mailbox?.unreadCount ?? 0;
							return (
								<RouterLink
									key={account.id}
									to={`/mailbox/${account.id}`}
									className={`group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-kumo-tint ${
										idx > 0 ? "border-t border-kumo-line" : ""
									}`}
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-sm font-bold text-kumo-default">
										{account.name.charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<div className="flex items-center gap-2">
											<div className="text-sm font-medium text-kumo-default truncate">
												{account.name}
											</div>
											{unreadCount > 0 && (
												<span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-kumo-primary text-white shrink-0">
													{unreadCount}
												</span>
											)}
										</div>
										<div className="text-sm text-kumo-subtle">
											{account.email}
										</div>
									</div>
									<Button
										variant="ghost"
										size="sm"
										shape="square"
										icon={<TrashIcon size={16} />}
										aria-label={`删除邮箱 ${account.email}`}
										onClick={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setMailboxToDelete({
												id: account.id,
												email: account.email,
											});
											setIsDeleteOpen(true);
										}}
									/>
								</RouterLink>
							);
						})}
					</div>
				) : (
					<div className="rounded-xl border border-kumo-line bg-kumo-base py-16 px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								{accounts.length > 0 ? "没有匹配的邮箱" : "还没有邮箱"}
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								{accounts.length > 0
									? "换个关键词试试，例如域名或显示名。"
									: "先接入域名，再新建邮箱，就能用自己的域名收发。"}
							</p>
							{accounts.length === 0 && (
								<div className="flex items-center gap-2">
									<Button
										variant="secondary"
										icon={<GlobeIcon size={16} />}
										onClick={() => {
											setConnectError(null);
											setConnectDone(false);
											setIsConnectOpen(true);
										}}
									>
										接入域名
									</Button>
									<Button
										variant="primary"
										icon={<PlusIcon size={16} />}
										onClick={() => setIsCreateOpen(true)}
									>
										创建邮箱
									</Button>
								</div>
							)}
						</div>
					</div>
				)}

				<div className="mt-8 rounded-xl border border-kumo-line bg-kumo-base p-5">
					<div className="flex items-center justify-between mb-3">
						<div className="text-sm font-medium text-kumo-default">默认签名模板</div>
						<label className="flex items-center gap-2 text-sm text-kumo-default cursor-pointer">
							<input
								type="checkbox"
								checked={tplEnabled}
								onChange={(e) => setTplEnabled(e.target.checked)}
							/>
							启用
						</label>
					</div>
					<p className="text-xs text-kumo-subtle mb-3">
						写信时，未设置自定义签名的邮箱会使用此模板。新创建的邮箱也会自动套用。各邮箱已启用的自定义签名优先。
					</p>
					<textarea
						value={tplText}
						onChange={(e) => setTplText(e.target.value)}
						placeholder={DEFAULT_SIGNATURE_TEMPLATE_TEXT}
						rows={6}
						disabled={!tplEnabled}
						className="w-full resize-y rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default placeholder:text-kumo-subtle focus:outline-none focus:ring-1 focus:ring-kumo-ring disabled:opacity-60"
					/>
					<p className="text-xs text-kumo-subtle mt-2">
						可用变量：{"{{email}}"}（邮箱）、{"{{domain}}"}（域名）、{"{{fromName}}"}（显示名）
					</p>
					{tplEnabled && tplText.trim() && (
						<div className="mt-4">
							<div className="text-xs font-medium text-kumo-subtle mb-1.5">
								预览（{previewEmail}）
							</div>
							<pre className="whitespace-pre-wrap rounded-lg border border-kumo-line bg-kumo-recessed px-3 py-2 text-sm text-kumo-default">{previewSignature}</pre>
						</div>
					)}
					<div className="flex justify-end mt-4">
						<Button
							variant="primary"
							size="sm"
							onClick={handleSaveTemplate}
							loading={isSavingTpl}
						>
							保存
						</Button>
					</div>
				</div>
			</div>

			{/* Connect domain Dialog */}
			<Dialog.Root
				open={isConnectOpen}
				onOpenChange={(open) => {
					setIsConnectOpen(open);
					if (!open) {
						setConnectError(null);
						setConnectDone(false);
					}
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						接入域名
					</Dialog.Title>
					<p className="text-sm text-kumo-subtle mb-4">
						不用改配置、不用重新发布。填域名，再在 Cloudflare 点两下邮件路由。
					</p>
					<form onSubmit={handleConnect} className="space-y-4">
						{connectError && (
							<Text variant="error" size="sm">
								{connectError}
							</Text>
						)}
						<Input
							label="域名"
							placeholder="example.com"
							size="sm"
							value={newDomain}
							onChange={(e) => setNewDomain(e.target.value)}
							required
						/>
						<ol className="text-sm text-kumo-default space-y-2 list-decimal pl-5">
							<li>Cloudflare 打开该域名 → Email → Email Routing → 启用（会自动加 MX）</li>
							<li>Routing rules → Catch-all → Send to a Worker → 选 agentic-inbox</li>
							<li>回到本页点「新建邮箱」，建 support@该域名（或任意前缀）</li>
						</ol>
						<p className="text-xs text-kumo-subtle">
							第一次往 Gmail 发信可能进垃圾箱。稳定后再给该域加 SPF / DKIM / DMARC。
						</p>
						<div className="flex justify-end gap-2 pt-1">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										取消
									</Button>
								)}
							/>
							{connectDone ? (
								<Button
									type="button"
									variant="primary"
									size="sm"
									onClick={() => {
										setIsConnectOpen(false);
										setIsCreateOpen(true);
									}}
								>
									去新建邮箱
								</Button>
							) : (
								<Button
									type="submit"
									variant="primary"
									size="sm"
									loading={isConnecting}
								>
									接入
								</Button>
							)}
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-5">
						新建邮箱
					</Dialog.Title>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						{domains.length === 0 && (
							<Text size="sm">
								还没有域名。先点「接入域名」，再来新建。
							</Text>
						)}
						<div>
							<span className="text-sm font-medium text-kumo-default mb-1.5 block">
								邮箱地址
							</span>
							<div className="flex items-center gap-2">
								<div className="flex-1">
									<Input
										aria-label="地址前缀"
										placeholder="info"
										size="sm"
										value={newPrefix}
										onChange={(e) => setNewPrefix(e.target.value)}
										required
									/>
								</div>
								<span className="text-sm text-kumo-subtle">@</span>
								{domains.length > 1 ? (
									<div className="flex-1">
							<Select
								aria-label="域名"
								value={selectedDomain}
								onValueChange={(value) => {
									if (value) setSelectedDomain(value);
								}}
							>
											{domains.map((d) => (
												<Select.Option key={d} value={d}>
													{d}
												</Select.Option>
											))}
										</Select>
									</div>
								) : (
									<span className="text-sm text-kumo-subtle">
										{selectedDomain || "未配置域名"}
									</span>
								)}
							</div>
						</div>
						<Input
							label="显示名（可选）"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										取消
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={!selectedDomain}
							>
								创建
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Delete Dialog */}
			<Dialog.Root
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setMailboxToDelete(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						删除邮箱
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						确定删除{" "}
						<strong className="text-kumo-default">
							{mailboxToDelete?.email}
						</strong>
						？此操作无法撤销。
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									取消
								</Button>
							)}
						/>
						<Button
							variant="destructive"
							size="sm"
							loading={isDeleting}
							onClick={handleDelete}
						>
							删除
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
