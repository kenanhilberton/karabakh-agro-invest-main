import { Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar.jsx';
import Footer from './components/Footer.jsx';
import Landing from './pages/Landing.jsx';
import MapPage from './pages/MapPage.jsx';
import ApplyWizard from './pages/ApplyWizard.jsx';
import Track from './pages/Track.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import Login from './pages/Login.jsx';
import MyGovLogin from './pages/MyGovLogin.jsx';
import Register from './pages/Register.jsx';
import Integration from './pages/Integration.jsx';
import Analytics from './pages/Analytics.jsx';
import Competition from './pages/Competition.jsx';
import Compare from './pages/Compare.jsx';
import Investments from './pages/Investments.jsx';
import InvestmentDetail from './pages/InvestmentDetail.jsx';
import InvestmentNew from './pages/InvestmentNew.jsx';
import { useSession } from './session.jsx';
import ChatBot from './components/ChatBot.jsx';

function RequireAuth({ children, roles }) {
  const { user } = useSession();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return children;
}

function NotFound() {
  return (
    <div className="mx-auto grid min-h-[70vh] max-w-xl place-items-center px-4 text-center">
      <div>
        <div className="text-6xl font-black text-brand-600">404</div>
        <h1 className="mt-3 text-2xl font-bold text-ink-900">Səhifə tapılmadı</h1>
        <p className="mt-2 text-sm text-slate-500">
          Axtardığınız səhifə mövcud deyil və ya köçürülüb.
        </p>
        <div className="mt-6 flex justify-center gap-3">
          <Link to="/" className="btn-primary">Ana səhifə</Link>
          <Link to="/map" className="btn-ghost">Xəritəyə bax</Link>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  // The "mygov ID" sign-in page is a standalone identity-provider screen —
  // hide the app chrome (navbar / footer / chatbot) to match the real portal.
  const bare = pathname === '/mygov';

  return (
    <div className="flex min-h-full flex-col">
      {!bare && <Navbar />}
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/compare" element={<Compare />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/investments/new" element={<RequireAuth><InvestmentNew /></RequireAuth>} />
          <Route path="/investments/:id" element={<InvestmentDetail />} />
          <Route path="/apply" element={<RequireAuth><ApplyWizard /></RequireAuth>} />
          <Route path="/apply/:landId" element={<RequireAuth><ApplyWizard /></RequireAuth>} />
          <Route path="/track" element={<Track />} />
          <Route path="/track/:code" element={<Track />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/competition" element={<Competition />} />
          <Route path="/integration" element={<Integration />} />
          <Route path="/login" element={<Login />} />
          <Route path="/mygov" element={<MyGovLogin />} />
          <Route path="/register" element={<Register />} />
          <Route
            path="/admin"
            element={
              <RequireAuth roles={['operator', 'admin']}>
                <AdminDashboard />
              </RequireAuth>
            }
          />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </main>
      {!bare && <Footer />}
      {!bare && <ChatBot />}
    </div>
  );
}
