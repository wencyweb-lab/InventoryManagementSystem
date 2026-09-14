'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2, Lock, CheckCircle2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'

export default function ResetPasswordPage() {
  return <Suspense fallback={<div className="p-8">Loading password reset...</div>}><ResetPasswordForm /></Suspense>
}

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const email = searchParams.get('email') || ''

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [completed, setCompleted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!token || !email) {
      return toast.error('Invalid or missing password reset link parameters')
    }

    if (password.length < 8) {
      return toast.error('Password must be at least 8 characters')
    }

    if (password !== confirmPassword) {
      return toast.error('Passwords do not match')
    }

    setLoading(true)
    try {
      const res = await axios.post('/api/auth/password/reset', {
        email,
        token,
        password,
      })

      toast.success(res.data?.message || 'Password reset successfully!')
      setCompleted(true)
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  if (!token || !email) {
    return (
      <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10">
        <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl border text-center space-y-4">
          <Logo />
          <h1 className="text-xl font-semibold text-destructive">Invalid Reset Link</h1>
          <p className="text-sm text-muted-foreground">
            This password reset link is invalid or incomplete. Please request a new link.
          </p>
          <Link href="/forgot-password" className="button-primary inline-flex">
            Request New Link
          </Link>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <svg
        aria-hidden="true"
        viewBox="0 0 800 800"
        className="pointer-events-none absolute h-[760px] w-[760px] text-muted opacity-80"
      >
        <circle cx="400" cy="400" r="280" fill="none" stroke="currentColor" strokeWidth="1" />
        <circle cx="400" cy="400" r="210" fill="none" stroke="currentColor" strokeWidth="1" />
        <path
          d="M80 400h640M400 80v640M174 174l452 452M626 174 174 626"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <circle cx="400" cy="400" r="110" fill="currentColor" opacity=".35" />
      </svg>

      <div className="z-10 w-full max-w-lg animate-fade-in rounded-xl bg-card py-6 text-card-foreground shadow-xl ring-1 ring-foreground/10">
        <div className="space-y-6 px-6">
          <Logo />
          <div>
            <h1 className="mb-2 text-2xl font-semibold">Set New Password</h1>
            <p className="text-sm text-muted-foreground">
              Resetting password for <strong className="text-foreground">{email}</strong>
            </p>
          </div>
        </div>

        <div className="mt-6 px-6">
          {completed ? (
            <div className="space-y-4 text-center py-4">
              <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h2 className="text-lg font-semibold">Password Changed!</h2>
              <p className="text-sm text-muted-foreground">
                Your password has been successfully updated. Redirecting you to sign in...
              </p>
              <Button onClick={() => router.push('/login')} className="w-full mt-2">
                Sign In Now
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="input-label">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="form-input h-10 w-full pl-10 pr-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="input-label">Confirm New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={8}
                    placeholder="Re-enter new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="form-input h-10 w-full pl-10"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="h-10 w-full mt-2">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Updating password...
                  </>
                ) : (
                  'Update Password'
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

