import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import dbConnect from '@/lib/db'
import User from '@/models/User'
import '@/models/Role'
import '@/models/Permission'

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt', maxAge: 7 * 24 * 60 * 60 },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null

        try {
          await dbConnect()
        } catch {
          console.error('Login failed: MongoDB is unavailable. Check MONGODB_URI and start the database.')
          throw new Error('Database unavailable')
        }
        const user = await User.findOne({ email: credentials.email.trim().toLowerCase(), deletedAt: null })
          .populate({ path: 'roles', match: { statut: true, deletedAt: null }, populate: { path: 'permissions' } })

        if (!user) return null

        if (!user.statut) throw new Error('Account deactivated')

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) return null

        const permissions: string[] = []
        for (const role of user.roles) {
          for (const perm of role.permissions) {
            if (!permissions.includes(perm.name)) permissions.push(perm.name)
          }
        }

        return {
          id: user._id.toString(),
          name: user.name,
          email: user.email,
          avatar: user.avatar,
          sessionVersion: user.sessionVersion ?? 0,
          permissions,
          roles: user.roles.map((r: any) => r.name),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.permissions = (user as any).permissions
        token.roles = (user as any).roles
        token.avatar = (user as any).avatar
        token.sessionVersion = (user as any).sessionVersion
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).permissions = token.permissions
        ;(session.user as any).roles = token.roles
        ;(session.user as any).avatar = token.avatar
        ;(session.user as any).sessionVersion = token.sessionVersion ?? 0
      }
      return session
    },
  },
  pages: { signIn: '/login', error: '/login' },
  secret: process.env.NEXTAUTH_SECRET,
}
