'use client'

import { useState } from 'react'
import Link from 'next/link'
import axios from 'axios'
import toast from 'react-hot-toast'
import { ArrowLeft, CheckCircle2, Loader2, Mail } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return toast.error('Please enter your email address')

    setLoading(true)
    try {
      const res = await axios.post('/api/auth/password/create', { email: email.trim() })
      setSubmitted(true)

      toast.success(res.data?.message || 'Reset link created')
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Error requesting password reset')
    } finally {
      setLoading(false)
    }
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
            <h1 className="mb-2 text-2xl font-semibold">Forgot Password</h1>
            <p className="text-sm text-muted-foreground">
              Enter your registered email address to receive password reset instructions.
            </p>
          </div>
        </div>

        <div className="mt-6 px-6">
          {submitted ? (
            <div className="space-y-5">
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm">
                <div className="flex items-center gap-2 font-semibold text-primary mb-1">
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                  Reset Instructions Sent
                </div>
                <p className="text-muted-foreground">
                  If an active account exists for <strong className="text-foreground">{email}</strong>, you will receive an email with instructions to reset your password.
                </p>
              </div>



              <div className="pt-2">
                <Link
                  href="/login"
                  className="flex items-center justify-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="input-label">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    placeholder="name@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="form-input h-10 w-full pl-10"
                  />
                </div>
              </div>

              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Generating reset link...
                  </>
                ) : (
                  'Send Reset Instructions'
                )}
              </Button>

              <div className="pt-2 text-center">
                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" /> Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}

