import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabaseClient';

const text = {
  appTitle: '와인 재고관리',
  inputDate: '입력날짜',
  wineName: '와인명',
  previousStock: '전월재고',
  incoming: '입고',
  outgoing: '출고',
  stock: '현 수량',
  actions: '관리',
  add: '추가',
  save: '저장',
  cancel: '취소',
  edit: '수정',
  delete: '삭제',
  loading: '불러오는 중입니다.',
  empty: '등록된 와인이 없습니다.',
  importExcel: '엑셀 불러오기',
  exportExcel: '엑셀 내보내기',
  configMissing: 'Supabase 환경변수를 설정하면 데이터가 표시됩니다.',
  required: '입력날짜와 와인명을 입력해 주세요.',
  addSuccess: '와인이 추가되었습니다.',
  updateSuccess: '와인이 수정되었습니다.',
  deleteSuccess: '휴지통으로 이동했습니다.',
  importSuccess: '엑셀 데이터를 불러왔습니다.',
  importFailed: '엑셀 파일을 읽지 못했습니다. Excel에서 CSV 형식으로 저장한 파일을 선택해 주세요.',
  confirmDelete: '정말 삭제하시겠습니까?',
  tableLabel: '와인 재고 목록',
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm() {
  return {
    input_date: getToday(),
    wine_name: '',
    previous_stock: '0',
    incoming: '0',
    outgoing: '0',
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function calculateStock(wine) {
  return toNumber(wine.previous_stock) + toNumber(wine.incoming) - toNumber(wine.outgoing);
}

function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

function normalizeWine(form) {
  return {
    input_date: form.input_date,
    wine_name: form.wine_name.trim(),
    previous_stock: toNumber(form.previous_stock),
    incoming: toNumber(form.incoming),
    outgoing: toNumber(form.outgoing),
  };
}

function parseCsvLine(line) {
  const cells = [];
  let cell = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"' && nextChar === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      cells.push(cell.trim());
      cell = '';
    } else {
      cell += char;
    }
  }

  cells.push(cell.trim());
  return cells;
}

function parseCsv(csvText) {
  return csvText
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map(parseCsvLine);
}

function escapeCsv(value) {
  const stringValue = String(value ?? '');
  return `"${stringValue.replace(/"/g, '""')}"`;
}

function downloadFile(fileName, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

async function saveInventoryLog({ actionType, wineId, wineName, beforeData, afterData, memo }) {
  if (!hasSupabaseConfig) return;

  try {
    const { error } = await supabase.from('inventory_logs').insert({
      action_type: actionType,
      wine_id: wineId,
      wine_name: wineName,
      before_data: beforeData,
      after_data: afterData,
      memo: memo ?? null,
    });

    if (error) {
      console.warn('Inventory log save failed:', error.message);
    }
  } catch (error) {
    console.warn('Inventory log save failed:', error);
  }
}

export default function App() {
  const [wines, setWines] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(createEmptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [filters, setFilters] = useState({ input_date: 'all', wine_name: 'all' });
  const [openFilter, setOpenFilter] = useState(null);

  const visibleWines = useMemo(
    () =>
      wines.filter((wine) => {
        const matchesDate = filters.input_date === 'all' || wine.input_date === filters.input_date;
        const matchesName = filters.wine_name === 'all' || wine.wine_name === filters.wine_name;
        return matchesDate && matchesName;
      }),
    [wines, filters],
  );

  const inputDateOptions = useMemo(
    () =>
      Array.from(new Set(wines.map((wine) => wine.input_date).filter(Boolean))).sort((a, b) =>
        String(b).localeCompare(String(a)),
      ),
    [wines],
  );

  const wineNameFilterOptions = useMemo(
    () =>
      Array.from(new Set(wines.map((wine) => wine.wine_name?.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'ko'),
      ),
    [wines],
  );

  const wineNameSuggestions = useMemo(() => {
    const keyword = form.wine_name.trim().toLocaleLowerCase();
    if (!keyword) return [];

    const uniqueNames = Array.from(
      new Set(wines.map((wine) => wine.wine_name?.trim()).filter(Boolean)),
    );

    return uniqueNames
      .filter((name) => name.toLocaleLowerCase().includes(keyword))
      .sort((a, b) => a.localeCompare(b, 'ko'))
      .slice(0, 5);
  }, [form.wine_name, wines]);

  const shouldShowSuggestions =
    showSuggestions && form.wine_name.trim() && wineNameSuggestions.length > 0;

  useEffect(() => {
    loadWines();
  }, []);

  function changeFilter(column, value) {
    setFilters((current) => ({ ...current, [column]: value }));
    setOpenFilter(null);
  }

  function toggleFilter(column) {
    setOpenFilter((current) => (current === column ? null : column));
  }

  function renderFilterMenu(column, options) {
    if (openFilter !== column) return null;

    return (
      <div className="filter-menu" role="menu">
        <button
          className={filters[column] === 'all' ? 'filter-option active' : 'filter-option'}
          type="button"
          onClick={() => changeFilter(column, 'all')}
        >
          전체
        </button>
        {options.map((option) => (
          <button
            className={filters[column] === option ? 'filter-option active' : 'filter-option'}
            key={option}
            type="button"
            onClick={() => changeFilter(column, option)}
          >
            {option}
          </button>
        ))}
      </div>
    );
  }

  async function loadWines() {
    if (!hasSupabaseConfig) {
      setMessage(text.configMissing);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('wines')
      .select(
        'id, input_date, wine_name, previous_stock, incoming, outgoing, is_deleted, deleted_at, created_at, updated_at',
      )
      .eq('is_deleted', false)
      .order('updated_at', { ascending: false, nullsFirst: false });

    if (error) {
      setMessage(`목록을 불러오지 못했습니다: ${error.message}`);
    } else {
      setWines(data ?? []);
      setMessage('');
    }
    setIsLoading(false);
  }

  async function addWine(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const nextWine = normalizeWine(form);

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    const savedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('wines')
      .insert({
        ...nextWine,
        is_deleted: false,
        deleted_at: null,
        created_at: savedAt,
        updated_at: savedAt,
      })
      .select(
        'id, input_date, wine_name, previous_stock, incoming, outgoing, is_deleted, deleted_at, created_at, updated_at',
      )
      .single();

    if (error) {
      setMessage(`와인을 추가하지 못했습니다: ${error.message}`);
    } else {
      await saveInventoryLog({
        actionType: 'CREATE',
        wineId: data.id,
        wineName: data.wine_name,
        beforeData: null,
        afterData: data,
      });
      setWines((current) => [data, ...current]);
      setForm(createEmptyForm());
      setShowSuggestions(false);
      formElement?.reset?.();
      setMessage(text.addSuccess);
    }
    setIsSaving(false);
  }

  function startEdit(wine) {
    setEditingId(wine.id);
    setEditForm({
      input_date: wine.input_date || getToday(),
      wine_name: wine.wine_name,
      previous_stock: String(wine.previous_stock ?? 0),
      incoming: String(wine.incoming ?? 0),
      outgoing: String(wine.outgoing ?? 0),
    });
    setMessage('');
    setShowSuggestions(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(createEmptyForm());
  }

  async function updateWine(id) {
    const nextWine = normalizeWine(editForm);
    const beforeWine = wines.find((wine) => wine.id === id) ?? null;

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    const updatedAt = new Date().toISOString();
    const { data, error } = await supabase
      .from('wines')
      .update({ ...nextWine, updated_at: updatedAt })
      .eq('id', id)
      .select(
        'id, input_date, wine_name, previous_stock, incoming, outgoing, is_deleted, deleted_at, created_at, updated_at',
      )
      .single();

    if (error) {
      setMessage(`와인을 수정하지 못했습니다: ${error.message}`);
    } else {
      await saveInventoryLog({
        actionType: 'UPDATE',
        wineId: data.id,
        wineName: data.wine_name,
        beforeData: beforeWine,
        afterData: data,
      });
      setWines((current) => [data, ...current.filter((wine) => wine.id !== id)]);
      cancelEdit();
      setMessage(text.updateSuccess);
    }
    setIsSaving(false);
  }

  async function deleteWine(wine) {
    if (!window.confirm(text.confirmDelete)) return;

    const deletedAt = new Date().toISOString();
    const afterData = {
      ...wine,
      is_deleted: true,
      deleted_at: deletedAt,
      updated_at: deletedAt,
    };

    setIsSaving(true);
    const { error } = await supabase
      .from('wines')
      .update({ is_deleted: true, deleted_at: deletedAt, updated_at: deletedAt })
      .eq('id', wine.id);

    if (error) {
      setMessage(`와인을 삭제하지 못했습니다: ${error.message}`);
    } else {
      await saveInventoryLog({
        actionType: 'DELETE',
        wineId: wine.id,
        wineName: wine.wine_name,
        beforeData: wine,
        afterData,
      });
      setWines((current) => current.filter((currentWine) => currentWine.id !== wine.id));
      setMessage(text.deleteSuccess);
    }
    setIsSaving(false);
  }

  function selectWineName(name) {
    setForm((current) => ({ ...current, wine_name: name }));
    setShowSuggestions(false);
  }

  function renderTextInput(label, value, onChange, type = 'text') {
    return (
      <label>
        <span>{label}</span>
        <input
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required
        />
      </label>
    );
  }

  function renderWineNameInput() {
    return (
      <label className="autocomplete-field">
        <span>{text.wineName}</span>
        <input
          type="text"
          value={form.wine_name}
          onBlur={() => window.setTimeout(() => setShowSuggestions(false), 120)}
          onChange={(event) => {
            setForm((current) => ({ ...current, wine_name: event.target.value }));
            setShowSuggestions(Boolean(event.target.value.trim()));
          }}
          onFocus={() => setShowSuggestions(Boolean(form.wine_name.trim()))}
          required
        />
        {shouldShowSuggestions && (
          <div className="autocomplete-list" role="listbox" aria-label="와인명 자동완성">
            {wineNameSuggestions.map((name) => (
              <button
                className="autocomplete-option"
                key={name}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => selectWineName(name)}
              >
                {name}
              </button>
            ))}
          </div>
        )}
      </label>
    );
  }

  function renderNumberInput(label, value, onChange) {
    return (
      <label>
        <span>{label}</span>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={value}
          onChange={(event) => onChange(digitsOnly(event.target.value))}
          required
        />
      </label>
    );
  }

  function renderEditNumberInput(label, value, onChange) {
    return (
      <input
        aria-label={label}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        value={value}
        onChange={(event) => onChange(digitsOnly(event.target.value))}
      />
    );
  }

  async function importExcelFile(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const rows = parseCsv(String(reader.result || ''));
        const header = rows[0]?.map((cell) => cell.replace(/\s/g, '').toLowerCase()) || [];
        const hasHeader = header.includes('와인명') || header.includes('품명') || header.includes('wine_name');
        const dataRows = hasHeader ? rows.slice(1) : rows;
        const nameIndex = hasHeader
          ? header.findIndex((cell) => ['와인명', '품명', 'wine_name', 'winename'].includes(cell))
          : 0;
        const previousStockIndex = hasHeader
          ? header.findIndex((cell) =>
              ['전월재고', '전월재고수량', 'previous_stock', 'previousstock'].includes(cell),
            )
          : 1;

        if (nameIndex < 0 || previousStockIndex < 0) {
          setMessage('엑셀 파일에 와인명과 전월재고 컬럼이 필요합니다.');
          return;
        }

        const stockByName = {};
        dataRows.forEach((row) => {
          const name = row[nameIndex]?.trim();
          if (!name) return;
          stockByName[name] = toNumber(row[previousStockIndex]);
        });

        const updatedAt = new Date().toISOString();
        const updatedWines = wines.map((wine) => ({
          ...wine,
          previous_stock: stockByName[wine.wine_name] ?? wine.previous_stock ?? 0,
          updated_at: Object.prototype.hasOwnProperty.call(stockByName, wine.wine_name)
            ? updatedAt
            : wine.updated_at,
        }));
        setWines(updatedWines);

        if (hasSupabaseConfig) {
          await Promise.all(
            updatedWines
              .filter((wine) => Object.prototype.hasOwnProperty.call(stockByName, wine.wine_name))
              .map((wine) =>
                supabase
                  .from('wines')
                  .update({ previous_stock: toNumber(wine.previous_stock), updated_at: updatedAt })
                  .eq('id', wine.id),
              ),
          );
          await loadWines();
        }

        setMessage(text.importSuccess);
      } catch {
        setMessage(text.importFailed);
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  function exportExcel() {
    const header = [
      text.inputDate,
      text.wineName,
      text.previousStock,
      text.incoming,
      text.outgoing,
      text.stock,
    ];
    const rows = visibleWines.map((wine) => [
      wine.input_date,
      wine.wine_name,
      wine.previous_stock ?? 0,
      wine.incoming,
      wine.outgoing,
      calculateStock(wine),
    ]);
    const csv = [header, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\n');
    downloadFile(`wine-inventory-${getToday()}.csv`, `\uFEFF${csv}`, 'text/csv;charset=utf-8;');
  }

  return (
    <main className="app">
      <section className="inventory-shell" aria-label={text.appTitle}>
        <div className="title-row">
          <h1>{text.appTitle}</h1>
        </div>

        <div className="excel-toolbar">
          <label className="toolbar-file">
            <span>{text.importExcel}</span>
            <input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => importExcelFile(event.target.files?.[0])}
            />
          </label>
          <button type="button" onClick={exportExcel}>
            {text.exportExcel}
          </button>
        </div>

        <form className="wine-form" onSubmit={addWine}>
          {renderTextInput(
            text.inputDate,
            form.input_date,
            (value) => setForm((current) => ({ ...current, input_date: value })),
            'date',
          )}
          {renderWineNameInput()}
          {renderNumberInput(text.previousStock, form.previous_stock, (value) =>
            setForm((current) => ({ ...current, previous_stock: value })),
          )}
          {renderNumberInput(text.incoming, form.incoming, (value) =>
            setForm((current) => ({ ...current, incoming: value })),
          )}
          {renderNumberInput(text.outgoing, form.outgoing, (value) =>
            setForm((current) => ({ ...current, outgoing: value })),
          )}
          <div className="calculated-field">
            <span>{text.stock}</span>
            <strong>{calculateStock(form)}</strong>
          </div>
          <button className="primary-button" type="submit" disabled={isSaving || !hasSupabaseConfig}>
            {text.add}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <div className="inventory-table" role="table" aria-label={text.tableLabel}>
          <div className="table-header" role="row">
            <span role="columnheader">
              <div className="header-filter">
                <span className="header-title">{text.inputDate}</span>
                <button
                  aria-label={`${text.inputDate} 필터`}
                  className={filters.input_date === 'all' ? 'filter-toggle' : 'filter-toggle active'}
                  type="button"
                  onClick={() => toggleFilter('input_date')}
                >
                  ▼
                </button>
                {renderFilterMenu('input_date', inputDateOptions)}
              </div>
            </span>
            <span role="columnheader">
              <div className="header-filter">
                <span className="header-title">{text.wineName}</span>
                <button
                  aria-label={`${text.wineName} 필터`}
                  className={filters.wine_name === 'all' ? 'filter-toggle' : 'filter-toggle active'}
                  type="button"
                  onClick={() => toggleFilter('wine_name')}
                >
                  ▼
                </button>
                {renderFilterMenu('wine_name', wineNameFilterOptions)}
              </div>
            </span>
            <span role="columnheader">{text.previousStock}</span>
            <span role="columnheader">{text.incoming}</span>
            <span role="columnheader">{text.outgoing}</span>
            <span role="columnheader">{text.stock}</span>
            <span role="columnheader">{text.actions}</span>
          </div>

          {isLoading ? (
            <div className="empty-state">{text.loading}</div>
          ) : visibleWines.length === 0 ? (
            <div className="empty-state">{text.empty}</div>
          ) : (
            visibleWines.map((wine) => {
              const currentStock = calculateStock(wine);
              const isEditing = editingId === wine.id;

              return (
                <div className="table-row" role="row" key={wine.id}>
                  {isEditing ? (
                    <>
                      <div className="cell" data-label={text.inputDate}>
                        <input
                          aria-label={text.inputDate}
                          type="date"
                          value={editForm.input_date}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, input_date: event.target.value }))
                          }
                        />
                      </div>
                      <div className="cell" data-label={text.wineName}>
                        <input
                          aria-label={text.wineName}
                          type="text"
                          value={editForm.wine_name}
                          onChange={(event) =>
                            setEditForm((current) => ({ ...current, wine_name: event.target.value }))
                          }
                        />
                      </div>
                      <div className="cell" data-label={text.previousStock}>
                        {renderEditNumberInput(text.previousStock, editForm.previous_stock, (value) =>
                          setEditForm((current) => ({ ...current, previous_stock: value })),
                        )}
                      </div>
                      <div className="cell" data-label={text.incoming}>
                        {renderEditNumberInput(text.incoming, editForm.incoming, (value) =>
                          setEditForm((current) => ({ ...current, incoming: value })),
                        )}
                      </div>
                      <div className="cell" data-label={text.outgoing}>
                        {renderEditNumberInput(text.outgoing, editForm.outgoing, (value) =>
                          setEditForm((current) => ({ ...current, outgoing: value })),
                        )}
                      </div>
                      <strong className="cell stock-cell" data-label={text.stock}>
                        {calculateStock(editForm)}
                      </strong>
                      <div className="row-actions">
                        <button type="button" onClick={() => updateWine(wine.id)} disabled={isSaving}>
                          {text.save}
                        </button>
                        <button type="button" onClick={cancelEdit} disabled={isSaving}>
                          {text.cancel}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="cell" data-label={text.inputDate}>
                        {wine.input_date}
                      </span>
                      <span className="cell wine-name" data-label={text.wineName}>
                        {wine.wine_name}
                      </span>
                      <span className="cell number-cell" data-label={text.previousStock}>
                        {wine.previous_stock ?? 0}
                      </span>
                      <span className="cell number-cell" data-label={text.incoming}>
                        {wine.incoming}
                      </span>
                      <span className="cell number-cell" data-label={text.outgoing}>
                        {wine.outgoing}
                      </span>
                      <strong
                        className={`cell stock-cell ${currentStock < 0 ? 'stock-negative' : ''}`}
                        data-label={text.stock}
                      >
                        {currentStock}
                      </strong>
                      <div className="row-actions">
                        <button
                          type="button"
                          onClick={() => startEdit(wine)}
                          disabled={isSaving || !hasSupabaseConfig}
                        >
                          {text.edit}
                        </button>
                        <button
                          className="danger"
                          type="button"
                          onClick={() => deleteWine(wine)}
                          disabled={isSaving || !hasSupabaseConfig}
                        >
                          {text.delete}
                        </button>
                      </div>
                    </>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
