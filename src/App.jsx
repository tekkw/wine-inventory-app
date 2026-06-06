import { useEffect, useMemo, useState } from 'react';
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import { hasSupabaseConfig, supabase } from './supabaseClient';

const text = {
  appTitle: '\uC640\uC778 \uC7AC\uACE0\uAD00\uB9AC',
  wineName: '\uC640\uC778\uBA85',
  incoming: '\uC785\uACE0',
  outgoing: '\uCD9C\uACE0',
  stock: '\uD604 \uC218\uB7C9',
  add: '\uCD94\uAC00',
  save: '\uC800\uC7A5',
  cancel: '\uCDE8\uC18C',
  edit: '\uC218\uC815',
  delete: '\uC0AD\uC81C',
  loading: '\uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4.',
  empty: '\uB4F1\uB85D\uB41C \uC640\uC778\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.',
  configMissing: 'Supabase \uD658\uACBD\uBCC0\uC218\uB97C \uC124\uC815\uD558\uBA74 \uB370\uC774\uD130\uAC00 \uD45C\uC2DC\uB429\uB2C8\uB2E4.',
  nameRequired: '\uC640\uC778\uBA85\uC744 \uC785\uB825\uD574 \uC8FC\uC138\uC694.',
  addSuccess: '\uC640\uC778\uC774 \uCD94\uAC00\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
  updateSuccess: '\uC640\uC778\uC774 \uC218\uC815\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
  deleteSuccess: '\uC640\uC778\uC774 \uC0AD\uC81C\uB418\uC5C8\uC2B5\uB2C8\uB2E4.',
  countLabel: '\uB4F1\uB85D\uB41C \uC640\uC778 \uC218',
  tableLabel: '\uC640\uC778 \uC7AC\uACE0 \uBAA9\uB85D',
};

const emptyForm = {
  wine_name: '',
  incoming: '',
  outgoing: '',
};

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

function normalizeWine(form) {
  return {
    wine_name: form.wine_name.trim(),
    incoming: toNumber(form.incoming),
    outgoing: toNumber(form.outgoing),
  };
}

export default function App() {
  const [wines, setWines] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(emptyForm);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  const sortedWines = useMemo(
    () => [...wines].sort((a, b) => a.wine_name.localeCompare(b.wine_name, 'ko')),
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
      .select('id, wine_name, incoming, outgoing')
      .order('wine_name', { ascending: true });

    if (error) {
      setMessage(`\uBAA9\uB85D\uC744 \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${error.message}`);
    } else {
      setWines(data ?? []);
      setMessage('');
    }
    setIsLoading(false);
  }

  async function addWine(event) {
    event.preventDefault();
    const nextWine = normalizeWine(form);

    if (!nextWine.wine_name) {
      setMessage(text.nameRequired);
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from('wines')
      .insert(nextWine)
      .select('id, wine_name, incoming, outgoing')
      .single();

    if (error) {
      setMessage(`\uC640\uC778\uC744 \uCD94\uAC00\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${error.message}`);
    } else {
      setWines((current) => [...current, data]);
      setForm(emptyForm);
      setMessage(text.addSuccess);
    }
    setIsSaving(false);
  }

  function startEdit(wine) {
    setEditingId(wine.id);
    setEditForm({
      wine_name: wine.wine_name,
      incoming: String(wine.incoming),
      outgoing: String(wine.outgoing),
    });
    setMessage('');
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm);
  }

  async function updateWine(id) {
    const nextWine = normalizeWine(editForm);

    if (!nextWine.wine_name) {
      setMessage(text.nameRequired);
      return;
    }

    setIsSaving(true);
    const { data, error } = await supabase
      .from('wines')
      .update(nextWine)
      .eq('id', id)
      .select('id, wine_name, incoming, outgoing')
      .single();

    if (error) {
      setMessage(`\uC640\uC778\uC744 \uC218\uC815\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${error.message}`);
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
      setMessage(`\uC640\uC778\uC744 \uC0AD\uC81C\uD558\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4: ${error.message}`);
    } else {
      setWines((current) => current.filter((wine) => wine.id !== id));
      setMessage(text.deleteSuccess);
    }
    setIsSaving(false);
  }

  function renderValueInput(label, value, onChange, type = 'number') {
    return (
      <label>
        <span>{label}</span>
        <input
          min={type === 'number' ? '0' : undefined}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          required={label === text.wineName}
        />
      </label>
    );
  }

  return (
    <main className="app">
      <section className="inventory-shell" aria-label={text.appTitle}>
        <div className="title-row">
          <h1>{text.appTitle}</h1>
          <div className="total-count" aria-label={text.countLabel}>
            {wines.length}
          </div>
        </div>

        <form className="wine-form" onSubmit={addWine}>
          {renderValueInput(
            text.wineName,
            form.wine_name,
            (value) => setForm((current) => ({ ...current, wine_name: value })),
            'text',
          )}
          {renderValueInput(text.incoming, form.incoming, (value) =>
            setForm((current) => ({ ...current, incoming: value })),
          )}
          {renderValueInput(text.outgoing, form.outgoing, (value) =>
            setForm((current) => ({ ...current, outgoing: value })),
          )}
          <button className="primary-button" type="submit" disabled={isSaving || !hasSupabaseConfig}>
            <Plus size={18} aria-hidden="true" />
            <span>{text.add}</span>
          </button>
        </form>

        {message && <p className="message">{message}</p>}

        <div className="inventory-table" role="table" aria-label={text.tableLabel}>
          <div className="table-header" role="row">
            <span role="columnheader">{text.wineName}</span>
            <span role="columnheader">{text.incoming}</span>
            <span role="columnheader">{text.outgoing}</span>
            <span role="columnheader">{text.stock}</span>
            <span className="action-space" aria-hidden="true" />
          </div>

          {isLoading ? (
            <div className="empty-state">{text.loading}</div>
          ) : sortedWines.length === 0 ? (
            <div className="empty-state">{text.empty}</div>
          ) : (
            sortedWines.map((wine) => {
              const currentStock = wine.incoming - wine.outgoing;
              const isEditing = editingId === wine.id;

              return (
                <div className="table-row" role="row" key={wine.id}>
                  {isEditing ? (
                    <>
                      <input
                        aria-label={text.wineName}
                        type="text"
                        value={editForm.wine_name}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, wine_name: event.target.value }))
                        }
                      />
                      <input
                        aria-label={text.incoming}
                        min="0"
                        type="number"
                        value={editForm.incoming}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, incoming: event.target.value }))
                        }
                      />
                      <input
                        aria-label={text.outgoing}
                        min="0"
                        type="number"
                        value={editForm.outgoing}
                        onChange={(event) =>
                          setEditForm((current) => ({ ...current, outgoing: event.target.value }))
                        }
                      />
                      <strong>{toNumber(editForm.incoming) - toNumber(editForm.outgoing)}</strong>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title={text.save}
                          onClick={() => updateWine(wine.id)}
                          disabled={isSaving}
                        >
                          <Check size={18} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          title={text.cancel}
                          onClick={cancelEdit}
                          disabled={isSaving}
                        >
                          <X size={18} aria-hidden="true" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className="wine-name">{wine.wine_name}</span>
                      <span>{wine.incoming}</span>
                      <span>{wine.outgoing}</span>
                      <strong className={currentStock < 0 ? 'stock-negative' : ''}>
                        {currentStock}
                      </strong>
                      <div className="row-actions">
                        <button
                          className="icon-button"
                          type="button"
                          title={text.edit}
                          onClick={() => startEdit(wine)}
                          disabled={isSaving || !hasSupabaseConfig}
                        >
                          <Pencil size={18} aria-hidden="true" />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          title={text.delete}
                          onClick={() => deleteWine(wine.id)}
                          disabled={isSaving || !hasSupabaseConfig}
                        >
                          <Trash2 size={18} aria-hidden="true" />
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
