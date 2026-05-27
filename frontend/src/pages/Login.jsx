import { useSearchParams } from 'react-router-dom';
import { LogIn, AlertCircle } from 'lucide-react';

const errorMessages = {
  unauthorized: "Email non autorizzata. Contatta l'amministratore.",
  no_email: "Impossibile recuperare l'email da Authentik.",
  callback_failed: "Errore durante l'autenticazione. Riprovare.",
  oidc_unavailable: 'Servizio di autenticazione non disponibile.',
};

export default function Login() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">

      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl p-8 w-full max-w-md">

        {/* Surveye logo image — inside the card, at the top */}
        <img
          src="/sy20.png"
          alt="Surveye"
          className="w-32 mx-auto mb-6 block drop-shadow select-none"
          onError={(e) => { e.target.style.display = 'none'; }}
        />

        {/* App branding */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Surveye<strong>SSM</strong>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1 text-sm">
            Sistema di monitoraggio eventi da Impianti via SIA DC09
          </p>
        </div>

        {/* Error message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
            <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-700 dark:text-red-400">
              {errorMessages[error] || 'Errore durante il login.'}
            </p>
          </div>
        )}

        {/* Login button */}
        <a
          href="/api/auth/authentik/redirect"
          className="flex items-center justify-center gap-3 w-full py-3 px-6
                     bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl
                     transition-colors shadow-sm"
        >
          <LogIn size={20} />
          Accedi con Authentik SSO
        </a>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500 mt-6">
          Accesso riservato agli operatori Surveye autorizzati.
          <br />
          Verrai reindirizzato al portale di autenticazione aziendale.
        </p>
      </div>
    </div>
  );
}
