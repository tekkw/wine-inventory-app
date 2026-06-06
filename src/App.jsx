import React, { useEffect, useMemo, useState } from 'react';
import { hasSupabaseConfig, supabase } from './supabaseClient';

const text = {
  appTitle: '와인 재고관리',
  inputDate: '입력날짜',
  wineName: '와인명',
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
  configMissing: 'Supabase 환경변수를 설정하면 데이터가 표시됩니다.',
  required: '입력날짜와 와인명을 입력해 주세요.',
  addSuccess: '와인이 추가되었습니다.',
  updateSuccess: '와인이 수정되었습니다.',
  deleteSuccess: '와인이 삭제되었습니다.',
  tableLabel: '와인 재고 목록',
};

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function createEmptyForm() {
  return {
    input_date: getToday(),
    wine_name: '',
    incoming: '0',
    outgoing: '0',
  };
}

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function digitsOnly(value) {
  return value.replace(/\D/g, '');
}

function normalizeWine(form) {
  return {
    input_date: form.input_date,
    wine_name: form.wine_name.trim(),
    incoming: toNumber(form.incoming),
    outgoing: toNumber(form.outgoing),
  };
}

export default function App() {
  const [wines, setWines] = useState([]);
  const [form, setForm] = useState(createEmptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(createEmptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sortedWines = useMemo(
    () =>
      [...wines].sort((a, b) => {
        const dateCompare = String(b.input_date).localeCompare(String(a.input_date));
        if (dateCompare !== 0) return dateCompare;
        return a.wine_name.localeCompare(b.wine_name, 'ko');
      }),
    [wines],
  );

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
      .select('id, input_date, wine_name, incoming, outgoing')
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

  async function addWine(event) {
    event.preventDefault();
    const nextWine = normalizeWine(form);

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from('wines')
      .insert(nextWine)
      .select('id, input_date, wine_name, incoming, outgoing')
      .single();

    if (error) {
      setMessage(`와인을 추가하지 못했습니다: ${error.message}`);
    } else {
      setWines((current) => [...current, data]);
      setForm(createEmptyForm());
      setMessage(text.addSuccess);
    }
    setIsSaving(false);
  }

  function startEdit(wine) {
    setEditingId(wine.id);
    setEditForm({
      input_date: wine.input_date || getToday(),
      wine_name: wine.wine_name,
      incoming: String(wine.incoming ?? 0),
      outgoing: String(wine.outgoing ?? 0),
    });
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(createEmptyForm());
  }

  async function updateWine(id) {
    const nextWine = normalizeWine(editForm);

    if (!nextWine.input_date || !nextWine.wine_name) {
      setMessage(text.required);
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from('wines')
      .update(nextWine)
      .eq('id', id)
      .select('id, input_date, wine_name, incoming, outgoing')
      .single();

    if (error) {
      setMessage(`와인을 수정하지 못했습니다: ${error.message}`);
    } else {
      setWines((current) => current.map((wine) => (wine.id === id ? data : wine)));
      cancelEdit();
      setMessage(text.updateSuccess);
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

  return (
    <main className="app">
      <section className="inventory-shell" aria-label={text.appTitle}>
        <div className="title-row">
          <h1>{text.appTitle}</h1>
        </div>

        <form className="wine-form" onSubmit={addWine}>
          {renderTextInput(
            text.inputDate,
            form.input_date,
            (value) => setForm((current) => ({ ...current, input_date: value })),
            'date',
          )}
          {renderTextInput(text.wineName, form.wine_name, (value) =>
            setForm((current) => ({ ...current, wine_name: value })),
          )}
          {renderNumberInput(text.incoming, form.incoming, (value) =>
            setForm((current) => ({ ...current, incoming: value })),
          )}
          {renderNumberInput(text.outgoing, form.outgoing, (value) =>
            setForm((current) => ({ ...current, outgoing: value })),
          )}
          <div className="calculated-field">
            <span>{text.stock}</span>
            <strong>{toNumber(form.incoming) - toNumber(form.outgoing)}</strong>
          </div>
          <button className="primary-button" type="submit" disabled={isSaving || !hasSupabaseConfig}>
            {text.add}
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <div className="inventory-table" role="table" aria-label={text.tableLabel}>
          <div className="table-header" role="row">
            <span role="columnheader">{text.inputDate}</span>
            <span role="columnheader">{text.wineName}</span>
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
              const currentStock = toNumber(wine.incoming) - toNumber(wine.outgoing);
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
                        {toNumber(editForm.incoming) - toNumber(editForm.outgoing)}
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
