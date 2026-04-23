const { createClient } = require('@supabase/supabase-js')

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { email } = req.body || {}

    if (!email) {
      return res.status(400).json({ error: 'Email is required' })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    )

    const appBaseUrl = process.env.APP_BASE_URL

    if (!appBaseUrl) {
      return res.status(500).json({ error: 'APP_BASE_URL is not set' })
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${appBaseUrl}/auth-callback.html?next=/reset-password.html`
    })

    if (error) {
      return res.status(400).json({ error: error.message })
    }

    return res.status(200).json({ success: true })
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}