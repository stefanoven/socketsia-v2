import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Save } from 'lucide-react';
import apiClient from '../api/apiClient.js';

export default function CustomerAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    customer: '',
    address: '',
    surveyeCode: '',
    subscription: '1',
    subscriptionDate: '',
  });

  const { data: subscriptions = [] } = useQuery({
    queryKey: ['subscriptions'],
    queryFn: async () => (await apiClient.get('/subscriptions')).data,
  });

  const mutation = useMutation({
    mutationFn: async (data) => (await apiClient.post('/customers', data)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      navigate('/customers');
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    mutation.mutate(form);
  };

  const inputCls = `w-full px-3 py-2 border border-slate-200 dark:border-slate-600 rounded-xl text-sm
                    bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200
                    focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder:text-slate-400`;

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/customers"
          className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300
                     hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Nuovo Cliente</h1>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6 space-y-4"
      >
        {mutation.error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-400">
            {mutation.error.response?.data?.error || 'Errore durante la creazione'}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Nome Cliente <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.customer}
            onChange={(e) => setForm({ ...form, customer: e.target.value })}
            className={inputCls}
            placeholder="Es. Mario Rossi"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Indirizzo</label>
          <input
            type="text"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className={inputCls}
            placeholder="Via Roma 1, Milano"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Codice Surveye <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            required
            value={form.surveyeCode}
            onChange={(e) => setForm({ ...form, surveyeCode: e.target.value })}
            className={inputCls}
            placeholder="CCOMXYYYZZZ"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Abbonamento</label>
          <select
            value={form.subscription}
            onChange={(e) => setForm({ ...form, subscription: e.target.value })}
            className={`${inputCls}`}
          >
            {subscriptions.map((s) => (
              <option key={s.id} value={s.id}>{s.description}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Data abbonamento</label>
          <input
            type="date"
            value={form.subscriptionDate}
            onChange={(e) => setForm({ ...form, subscriptionDate: e.target.value })}
            className={inputCls}
          />
        </div>

        <p className="text-xs text-slate-400 dark:text-slate-500">
          Il numero account (7 cifre) verrà generato automaticamente.
        </p>

        <div className="flex gap-3 pt-2">
          <Link
            to="/customers"
            className="flex-1 py-2.5 text-center text-sm font-medium text-slate-600 dark:text-slate-400
                       bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
          >
            Annulla
          </Link>
          <button
            type="submit"
            disabled={mutation.isPending}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white
                       bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-50"
          >
            <Save size={16} />
            {mutation.isPending ? 'Creazione...' : 'Crea cliente'}
          </button>
        </div>
      </form>
    </div>
  );
}
