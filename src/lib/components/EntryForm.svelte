<!--
	Entry create/edit form. Tags are entered space-separated, with existing
	tags offered as one-tap suggestions to avoid near-duplicate tags.
-->
<script lang="ts">
	import type { Entry, EntryInput, ValueType } from '$lib/types';
	import { parseTags } from '$lib/db/filter';

	interface Props {
		/** Entry being edited, or null when creating a new one. */
		entry: Entry | null;
		/** All known tags, offered as suggestions. */
		existingTags: string[];
		/** Called with the validated input when the user saves. */
		onsave: (input: EntryInput) => void;
		/** Called when the user deletes the entry (edit mode only). */
		ondelete?: () => void;
		/** Called when the user cancels editing. */
		oncancel: () => void;
	}

	let { entry, existingTags, onsave, ondelete, oncancel }: Props = $props();

	/** Maximum number of characters allowed per tag. */
	const MAX_TAG_LENGTH = 7;
	/** Maximum number of tags allowed per entry. */
	const MAX_TAG_COUNT = 5;

	// Capturing only the initial value of `entry` is intentional: the parent
	// remounts this form via {#key} whenever the selected entry changes.
	// svelte-ignore state_referenced_locally
	let tagsText = $state(entry?.tags.join(' ') ?? '');
	// svelte-ignore state_referenced_locally
	let name = $state(entry?.name ?? '');
	// svelte-ignore state_referenced_locally
	let valueType = $state<ValueType>(entry?.valueType ?? 'text');
	// svelte-ignore state_referenced_locally
	let value = $state(entry?.value ?? '');
	// svelte-ignore state_referenced_locally
	let memo = $state(entry?.memo ?? '');
	let errorMessage = $state('');

	const currentTags = $derived(parseTags(tagsText));
	const suggestions = $derived(existingTags.filter((tag) => !currentTags.includes(tag)));

	/**
	 * Appends a suggested tag to the tag input.
	 * @param tag - Tag to append.
	 */
	function addTag(tag: string): void {
		tagsText = [...currentTags, tag].join(' ');
	}

	/** Validates the form and emits the save event. */
	function save(): void {
		if (name.trim().length === 0) {
			errorMessage = '項目名を入力してください';
			return;
		}
		if (currentTags.length > MAX_TAG_COUNT) {
			errorMessage = `タグは${MAX_TAG_COUNT}個まで登録できます`;
			return;
		}
		const overlongTag = currentTags.find((tag) => tag.length > MAX_TAG_LENGTH);
		if (overlongTag) {
			errorMessage = `タグは${MAX_TAG_LENGTH}文字以内で入力してください（「${overlongTag}」）`;
			return;
		}
		errorMessage = '';
		onsave({
			tags: currentTags,
			name: name.trim(),
			valueType,
			value: value.trim(),
			memo: memo.trim()
		});
	}

	/**
	 * Formats an ISO timestamp for display.
	 * @param iso - ISO 8601 timestamp.
	 * @returns Localized date-time string.
	 */
	function formatDateTime(iso: string): string {
		return new Date(iso).toLocaleString('ja-JP');
	}

	/**
	 * Returns today's date in the yyyy-mm-dd format expected by `<input type="date">`.
	 * @returns Today's local date.
	 */
	function todayDateString(): string {
		const now = new Date();
		const month = String(now.getMonth() + 1).padStart(2, '0');
		const day = String(now.getDate()).padStart(2, '0');
		return `${now.getFullYear()}-${month}-${day}`;
	}

	/** Prefills today's date when switching to the date type with an empty value. */
	function handleValueTypeChange(): void {
		if (valueType === 'date' && value.trim().length === 0) {
			value = todayDateString();
		}
	}
</script>

<form
	class="flex flex-col gap-4 p-4"
	onsubmit={(event) => {
		event.preventDefault();
		save();
	}}
>
	<h2 class="text-lg font-bold">{entry ? '編集' : '新規登録'}</h2>

	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium">タグ（スペース区切り）</span>
		<input
			type="text"
			class="rounded border border-slate-300 px-3 py-2"
			placeholder="例: 家電 保証"
			bind:value={tagsText}
		/>
		<span class="text-xs text-slate-500">
			1タグ{MAX_TAG_LENGTH}文字以内・{MAX_TAG_COUNT}個まで
		</span>
	</label>
	{#if suggestions.length > 0}
		<div class="flex flex-wrap gap-1.5">
			{#each suggestions as tag (tag)}
				<button
					type="button"
					class="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-600 hover:bg-slate-200"
					onclick={() => addTag(tag)}
				>
					+ {tag}
				</button>
			{/each}
		</div>
	{/if}

	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium">項目 *</span>
		<input
			type="text"
			class="rounded border border-slate-300 px-3 py-2"
			placeholder="例: 冷蔵庫の保証期限"
			bind:value={name}
		/>
	</label>

	<div class="flex gap-3">
		<label class="flex flex-col gap-1 text-sm">
			<span class="font-medium">データ型</span>
			<select
				class="rounded border border-slate-300 px-2 py-2"
				bind:value={valueType}
				onchange={handleValueTypeChange}
			>
				<option value="text">テキスト</option>
				<option value="date">年月日</option>
			</select>
		</label>
		<label class="flex flex-1 flex-col gap-1 text-sm">
			<span class="font-medium">値</span>
			{#if valueType === 'date'}
				<input type="date" class="rounded border border-slate-300 px-3 py-2" bind:value />
			{:else}
				<input
					type="text"
					maxlength="100"
					class="rounded border border-slate-300 px-3 py-2"
					bind:value
				/>
			{/if}
		</label>
	</div>

	<label class="flex flex-col gap-1 text-sm">
		<span class="font-medium">メモ</span>
		<textarea
			rows="3"
			maxlength="500"
			class="rounded border border-slate-300 px-3 py-2"
			bind:value={memo}
		></textarea>
	</label>

	{#if entry}
		<dl class="grid grid-cols-2 gap-1 text-xs text-slate-500">
			<dt>登録日時</dt>
			<dd>{formatDateTime(entry.createdAt)}</dd>
			<dt>最終更新</dt>
			<dd>{formatDateTime(entry.updatedAt)}</dd>
		</dl>
	{/if}

	{#if errorMessage}
		<p class="text-sm text-red-600">{errorMessage}</p>
	{/if}

	<div class="flex items-center gap-2">
		<button
			type="submit"
			class="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
		>
			保存
		</button>
		<button
			type="button"
			class="rounded border border-slate-300 px-4 py-2 text-sm hover:bg-slate-100"
			onclick={oncancel}
		>
			キャンセル
		</button>
		{#if entry && ondelete}
			<button
				type="button"
				class="ml-auto rounded px-4 py-2 text-sm text-red-600 hover:bg-red-50"
				onclick={ondelete}
			>
				削除
			</button>
		{/if}
	</div>
</form>
