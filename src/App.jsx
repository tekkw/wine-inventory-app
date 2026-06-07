import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabaseClient';

const imageBucket = 'wine-images';

const text = {
  appTitle: '와인 재고관리',
  image: '이미지',
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
  noImage: '이미지 없음',
  importExcel: '엑셀 불러오기',
  exportExcel: '엑셀 내보내기',
  configMissing: 'Supabase 환경변수를 설정하면 데이터가 표시됩니다.',
  required: '입력날짜와 와인명을 입력해 주세요.',
  addSuccess: '와인이 추가되었습니다.',
  updateSuccess: '와인이 수정되었습니다.',
  deleteSuccess: '와인이 삭제되었습니다.',
  importSuccess: '엑셀 데이터를 불러왔습니다.',
  importFailed: '엑셀 파일을 읽지 못했습니다. Excel에서 CSV 형식으로 저장한 파일을 선택해 주세요.',
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

function getFileExtension(fileName) {
  const extension = fileName.split('.').pop();
  return extension ? extension.toLowerCase() : 'jpg';
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

export default function App() {
  const [wines, setWines] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [imageFile, setImageFile] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(createEmptyForm);
  const [editImageFile, setEditImageFile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  const sortedWines = useMemo(
    () =>
      [...wines].sort((a, b) => {
        const dateCompare = String(b.input_date).localeCompare(String(a.input_date));
        if (dateCompare !== 0) return dateCompare;
        return a.wine_name.localeCompare(b.wine_name, 'ko');
      }),
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

  async function loadWines() {
    if (!hasSupabaseConfig) {
      setMessage(text.configMissing);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    const { data, error } = await supabase
      .from('wines')
      .select('id, image_url, input_date, wine_name, previous_stock, incoming, outgoing')
      .order('input_date', { ascending: false })
      .order('wine_name', { ascending: true });

    if (error) {
      setMessage(`목록을 불러오지 못했습니다: ${error.message}`);
    } else {
      setWines(data ?? []);
      setMessage('');
    }
    setIsLoading(false);
  }

  async function uploadImage(file) {
    if (!file) return null;

    const extension = getFileExtension(file.name);
    const filePath = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from(imageBucket).upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
    });

    if (error) {
      throw new Error(`이미지를 업로드하지 못했습니다: ${error.message}`);
    }

    const { data } = supabase.storage.from(imageBucket).getPublicUrl(filePath);
    return data.publicUrl;
  }

  async function addWine(event) {
    event.preventDefault();
    const nextWine = normalizeWine(form);

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    try {
      const imageUrl = await uploadImage(imageFile);
      const { data, error } = await supabase
        .from('wines')
        .insert({ ...nextWine, image_url: imageUrl })
        .select('id, image_url, input_date, wine_name, previous_stock, incoming, outgoing')
        .single();

      if (error) {
        setMessage(`와인을 추가하지 못했습니다: ${error.message}`);
      } else {
        setWines((current) => [...current, data]);
        setForm(createEmptyForm());
        setImageFile(null);
        setShowSuggestions(false);
        event.currentTarget.reset();
        setMessage(text.addSuccess);
      }
    } catch (error) {
      setMessage(error.message);
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
      image_url: wine.image_url || null,
    });
    setEditImageFile(null);
    setMessage('');
    setShowSuggestions(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(createEmptyForm());
    setEditImageFile(null);
  }

  async function updateWine(id) {
    const nextWine = normalizeWine(editForm);

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    try {
      const newImageUrl = await uploadImage(editImageFile);
      const imageUrl = newImageUrl || editForm.image_url || null;
      const { data, error } = await supabase
        .from('wines')
        .update({ ...nextWine, image_url: imageUrl })
        .eq('id', id)
        .select('id, image_url, input_date, wine_name, previous_stock, incoming, outgoing')
        .single();

      if (error) {
        setMessage(`와인을 수정하지 못했습니다: ${error.message}`);
      } else {
        setWines((current) => current.map((wine) => (wine.id === id ? data : wine)));
        cancelEdit();
        setMessage(text.updateSuccess);
      }
    } catch (error) {
      setMessage(error.message);
    }
    setIsSaving(false);
  }

  async function deleteWine(id) {
    setIsSaving(true);
    const { error } = await supabase.from('wines').delete().eq('id', id);

    if (error) {
      setMessage(`와인을 삭제하지 못했습니다: ${error.message}`);
    } else {
      setWines((current) => current.filter((wine) => wine.id !== id));
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

  function renderImageInput() {
    return (
      <label className="file-field">
        <span>{text.image}</span>
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setImageFile(event.target.files?.[0] || null)}
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

  function renderThumbnail(wine) {
    if (!wine.image_url) {
      return <span className="no-image">{text.noImage}</span>;
    }

    return <img className="thumbnail" src={wine.image_url} alt={`${wine.wine_name} 이미지`} />;
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

        const updatedWines = wines.map((wine) => ({
          ...wine,
          previous_stock: stockByName[wine.wine_name] ?? wine.previous_stock ?? 0,
        }));
        setWines(updatedWines);

        if (hasSupabaseConfig) {
          await Promise.all(
            updatedWines
              .filter((wine) => Object.prototype.hasOwnProperty.call(stockByName, wine.wine_name))
              .map((wine) =>
                supabase
                  .from('wines')
                  .update({ previous_stock: toNumber(wine.previous_stock) })
                  .eq('id', wine.id),
              ),
          );
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
      text.image,
      text.inputDate,
      text.wineName,
      text.previousStock,
      text.incoming,
      text.outgoing,
      text.stock,
    ];
    const rows = sortedWines.map((wine) => [
      wine.image_url || '',
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
          {renderImageInput()}
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
            <span role="columnheader">{text.image}</span>
            <span role="columnheader">{text.inputDate}</span>
            <span role="columnheader">{text.wineName}</span>
            <span role="columnheader">{text.previousStock}</span>
            <span role="columnheader">{text.incoming}</span>
            <span role="columnheader">{text.outgoing}</span>
            <span role="columnheader">{text.stock}</span>
            <span role="columnheader">{text.actions}</span>
          </div>

          {isLoading ? (
            <div className="empty-state">{text.loading}</div>
          ) : sortedWines.length === 0 ? (
            <div className="empty-state">{text.empty}</div>
          ) : (
            sortedWines.map((wine) => {
              const currentStock = calculateStock(wine);
              const isEditing = editingId === wine.id;

              return (
                <div className="table-row" role="row" key={wine.id}>
                  {isEditing ? (
                    <>
                      <div className="cell image-cell" data-label={text.image}>
                        {editForm.image_url ? (
                          <img
                            className="thumbnail"
                            src={editForm.image_url}
                            alt={`${editForm.wine_name} 이미지`}
                          />
                        ) : (
                          <span className="no-image">{text.noImage}</span>
                        )}
                        <input
                          aria-label={text.image}
                          type="file"
                          accept="image/*"
                          onChange={(event) => setEditImageFile(event.target.files?.[0] || null)}
                        />
                      </div>
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
                      <span className="cell image-cell" data-label={text.image}>
                        {renderThumbnail(wine)}
                      </span>
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
                          onClick={() => deleteWine(wine.id)}
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
