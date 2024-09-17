import { createSignal, createEffect, onMount, Show } from 'solid-js'
import { supabase, createEvent } from './supabaseClient'
import { Auth } from '@supabase/auth-ui-solid'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { SolidMarkdown } from 'solid-markdown'

function App() {
  const [user, setUser] = createSignal(null)
  const [currentPage, setCurrentPage] = createSignal('login')
  const [loading, setLoading] = createSignal(false)
  const [typeOfWork, setTypeOfWork] = createSignal('')
  const [userRole, setUserRole] = createSignal('')
  const [report, setReport] = createSignal('')

  const checkUserSignedIn = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setCurrentPage('homePage')
    }
  }

  onMount(checkUserSignedIn)

  createEffect(() => {
    const authListener = supabase.auth.onAuthStateChange((_, session) => {
      if (session?.user) {
        setUser(session.user)
        setCurrentPage('homePage')
      } else {
        setUser(null)
        setCurrentPage('login')
      }
    })

    return () => {
      authListener.data.unsubscribe()
    }
  })

  const handleGenerateReport = async () => {
    setLoading(true)
    setReport('')
    try {
      const prompt = `Provide a report of all the UK health & safety legislation that applies to ${typeOfWork()}, with detailed advice on how a ${userRole()} might safely approach the project, and a comprehensive list of risks likely to be encountered with suggested mitigation strategies.`
      const result = await createEvent('chatgpt_request', {
        prompt: prompt,
        response_type: 'text'
      })
      setReport(result)
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div class="flex flex-col items-center justify-center min-h-screen bg-gray-100 text-gray-800">
      <Show
        when={currentPage() === 'homePage'}
        fallback={
          <div class="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
            <h2 class="text-2xl font-bold mb-4 text-center">Sign in with ZAPT</h2>
            <a href="https://www.zapt.ai" target="_blank" rel="noopener noreferrer" class="text-blue-500 hover:underline mb-4 block text-center">
              Learn more about ZAPT
            </a>
            <Auth 
              supabaseClient={supabase}
              appearance={{ theme: ThemeSupa }}
              providers={['google', 'facebook', 'apple']}
            />
          </div>
        }
      >
        <div class="w-full max-w-2xl p-6 bg-white rounded-lg shadow-md">
          <div class="flex justify-between items-center mb-6">
            <h1 class="text-3xl font-bold">Health and Safety Manager</h1>
            <button
              class="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 cursor-pointer"
              onClick={handleSignOut}
            >
              Sign Out
            </button>
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 mb-2" for="typeOfWork">
              Type of Work
            </label>
            <input
              id="typeOfWork"
              type="text"
              class="w-full p-2 border border-gray-300 rounded box-border"
              value={typeOfWork()}
              onInput={(e) => setTypeOfWork(e.target.value)}
            />
          </div>
          <div class="mb-4">
            <label class="block text-gray-700 mb-2" for="userRole">
              Your Role
            </label>
            <input
              id="userRole"
              type="text"
              class="w-full p-2 border border-gray-300 rounded box-border"
              value={userRole()}
              onInput={(e) => setUserRole(e.target.value)}
            />
          </div>
          <button
            class="w-full px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer disabled:bg-gray-400"
            onClick={handleGenerateReport}
            disabled={loading() || !typeOfWork() || !userRole()}
          >
            <Show when={loading()}>
              Generating Report...
            </Show>
            <Show when={!loading()}>
              Generate Report
            </Show>
          </button>
          <Show when={report()}>
            <div class="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <SolidMarkdown children={report()} />
            </div>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default App