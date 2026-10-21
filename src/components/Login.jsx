import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

export function Login() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
    }
    setLoading(false);
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#f8fafc]">
      <div className="w-full max-w-md bg-white p-8 rounded-2xl shadow-sm border border-[#e2e8f0]">
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center mb-4 shadow-sm"
            style={{ background: 'linear-gradient(135deg, #6366f1, #4f46e5)' }}
          >
            <span className="text-white font-bold text-xl leading-none">C</span>
          </div>
          <h2 className="text-2xl font-bold text-[#0f172a]">Welcome to ChatFlow</h2>
          <p className="text-[#64748b] text-sm mt-1">Sign in to your account to continue</p>
        </div>

        {/* Form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 font-medium text-center animate-fade-in">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-[#0f172a]">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              required
              className="px-3 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-sm text-[#0f172a]
                         placeholder:text-[#94a3b8] focus:outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-all"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[13px] font-semibold text-[#0f172a]">Password</label>
              {/* <a href="#" className="text-[12px] font-semibold text-[#4f46e5] hover:text-[#4338ca]">Forgot password?</a> */}
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 bg-white border border-[#cbd5e1] rounded-lg text-sm text-[#0f172a]
                           placeholder:text-[#94a3b8] focus:outline-none focus:border-[#4f46e5] focus:ring-1 focus:ring-[#4f46e5] transition-all pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94a3b8] hover:text-[#64748b] transition-colors focus:outline-none"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full flex items-center justify-center py-2.5 px-4 rounded-lg bg-[#4f46e5] hover:bg-[#4338ca]
                       text-white font-semibold text-sm transition-all disabled:opacity-70 disabled:cursor-not-allowed shadow-sm"
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        {/* <p className="text-center text-sm text-[#64748b] mt-8">
          Don't have an account? <a href="#" className="font-semibold text-[#4f46e5] hover:text-[#4338ca]">Contact admin</a>
        </p> */}

      </div>
    </div>
  );
}
