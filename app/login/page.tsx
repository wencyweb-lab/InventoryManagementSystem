'use client'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, Loader2 } from 'lucide-react'
import { Logo } from '@/components/layout/Logo'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      const result = await signIn('credentials', {
        email: data.email,
        password: data.password,
        redirect: false,
      })

      if (result?.error === 'Account deactivated') {
        toast.error('Your account has been deactivated. Contact administrator.')
      } else if (result?.error === 'Database unavailable') {
        toast.error('Database unavailable. Start MongoDB and try again.')
      } else if (result?.error) {
        toast.error('Invalid email or password.')
      } else if (result?.ok) {
        router.push('/dashboard')
        router.refresh()
      } else {
        toast.error('Unable to sign in. Please try again.')
      }
    } catch {
      toast.error('Unable to reach the server. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4 py-10 sm:px-6 lg:px-8">
      <svg aria-hidden="true" viewBox="0 0 800 800" className="pointer-events-none absolute h-[760px] w-[760px] text-muted opacity-80"><circle cx="400" cy="400" r="280" fill="none" stroke="currentColor" strokeWidth="1" /><circle cx="400" cy="400" r="210" fill="none" stroke="currentColor" strokeWidth="1" /><path d="M80 400h640M400 80v640M174 174l452 452M626 174 174 626" fill="none" stroke="currentColor" strokeWidth="1" /><circle cx="400" cy="400" r="110" fill="currentColor" opacity=".35" /></svg>

      <div className="z-10 w-full max-w-lg animate-fade-in rounded-xl bg-card py-6 text-card-foreground shadow-xl ring-1 ring-foreground/10">
        <div className="space-y-6 px-6">
          <Logo />
          <div>
            <h1 className="mb-2 text-2xl font-semibold">Sign in to Stocky</h1>
            <p className="text-base text-muted-foreground">Manage inventory, sales and purchasing from one workspace.</p>
          </div>
        </div>

        <div className="mt-6 px-6">
          <p className="mb-5 text-sm text-muted-foreground">Use your assigned account or the development administrator.</p>
          <Button type="button" variant="outline" className="mb-6 w-full" onClick={() => { setValue('email', 'admin@example.com'); setValue('password', '123456'); }}>Fill administrator credentials</Button>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            {/* Email */}
            <div>
              <label className="input-label">Email Address</label>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@example.com"
                autoComplete="email"
                className="form-input h-10 w-full"
              />
              {errors.email && (
                <p className="text-destructive text-xs mt-1">{errors.email.message}</p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="input-label mb-0">Password</label>
                <Link
                  href="/forgot-password"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  className="form-input h-10 w-full pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-destructive text-xs mt-1">{errors.password.message}</p>
              )}
            </div>

            {/* Submit */}
            <Button
              type="submit"
              disabled={loading}
              className="h-10 w-full"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Signing in...</>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-4"><span className="h-px flex-1 bg-border" /><span className="text-xs text-muted-foreground">secure credentials login</span><span className="h-px flex-1 bg-border" /></div>
          <p className="text-center text-xs text-muted-foreground">Default development access: <span className="font-medium text-foreground">admin@example.com</span></p>
        </div>
      </div>
    </main>
  )
}
