import { createSignal, createEffect, onMount, Show, For } from 'solid-js'
import { supabase, createEvent } from './supabaseClient'
import { Auth } from '@supabase/auth-ui-solid'
import { ThemeSupa } from '@supabase/auth-ui-shared'
import { SolidMarkdown } from 'solid-markdown'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, Table, TableRow, TableCell, TextRun } from 'docx'

function App() {
  const [user, setUser] = createSignal(null)
  const [currentPage, setCurrentPage] = createSignal('login')
  const [loading, setLoading] = createSignal(false)
  const [typeOfWork, setTypeOfWork] = createSignal('')
  const [userRole, setUserRole] = createSignal('')
  const [report, setReport] = createSignal('')
  const [risksAndMitigations, setRisksAndMitigations] = createSignal([])
  const [sharing, setSharing] = createSignal(false)

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
    setRisksAndMitigations([])
    try {
      const prompt = `Provide a report of all the UK health & safety legislation that applies to ${typeOfWork()}, with detailed advice on how a ${userRole()} might safely approach the project.`

      // Get the main report
      const reportResult = await createEvent('chatgpt_request', {
        prompt: prompt,
        response_type: 'text'
      })
      setReport(reportResult)

      // Get the risks and mitigations in JSON format
      const risksPrompt = `Provide a comprehensive list of risks likely to be encountered during ${typeOfWork()} and suggested mitigation strategies, in the following JSON format:

{
  "risks_and_mitigations": [
    {
      "risk": "Description of the risk",
      "mitigation": "Suggested mitigation strategy"
    },
    // ... more items
  ]
}

Ensure the JSON is valid and only include the "risks_and_mitigations" array.`

      const risksResult = await createEvent('chatgpt_request', {
        prompt: risksPrompt,
        response_type: 'json'
      })
      if (risksResult && risksResult.risks_and_mitigations) {
        setRisksAndMitigations(risksResult.risks_and_mitigations)
      } else {
        console.error('Risks and mitigations not found in the response')
      }
    } catch (error) {
      console.error('Error generating report:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShareReport = (method) => {
    setSharing(true)
    const reportText = `Health and Safety Report\n\n${report()}\n\n`
    // Add the risks and mitigations to the report text
    let risksText = 'Risks and Mitigations:\n\n'
    risksAndMitigations().forEach(item => {
      risksText += `Risk: ${item.risk}\nMitigation: ${item.mitigation}\n\n`
    })

    const fullReport = reportText + risksText

    const encodedReport = encodeURIComponent(fullReport)

    if (method === 'email') {
      const emailLink = `mailto:?subject=Health and Safety Report&body=${encodedReport}`
      window.location.href = emailLink
    } else if (method === 'whatsapp') {
      const whatsappLink = `https://wa.me/?text=${encodedReport}`
      window.open(whatsappLink, '_blank')
    }

    setTimeout(() => setSharing(false), 1000)
  }

  const handleExportToWord = async () => {
    const doc = new Document()

    // Add the main report
    const reportParagraphs = report().split('\n').map(line => new Paragraph(line))

    // Create table rows for risks and mitigations
    const tableRows = [
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Risk', bold: true })] })],
          }),
          new TableCell({
            children: [new Paragraph({ children: [new TextRun({ text: 'Mitigation', bold: true })] })],
          }),
        ],
      }),
      ...risksAndMitigations().map(item => new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(item.risk)] }),
          new TableCell({ children: [new Paragraph(item.mitigation)] }),
        ],
      })),
    ]

    const table = new Table({
      rows: tableRows,
    })

    doc.addSection({
      properties: {},
      children: [
        new Paragraph({
          text: 'Health and Safety Report',
          heading: 'Title',
          spacing: { after: 300 }
        }),
        ...reportParagraphs,
        new Paragraph({ text: '', spacing: { after: 300 } }),
        new Paragraph({
          text: 'Risks and Mitigations',
          heading: 'Heading1',
          spacing: { after: 300 }
        }),
        table,
      ],
    })

    const blob = await Packer.toBlob(doc)
    saveAs(blob, 'Health_and_Safety_Report.docx')
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
            <Show when={risksAndMitigations().length > 0}>
              <h2 class="text-2xl font-bold mt-6 mb-4">Risks and Mitigations</h2>
              <div class="overflow-x-auto">
                <table class="min-w-full bg-white">
                  <thead>
                    <tr>
                      <th class="py-2 px-4 border-b-2 border-gray-300 text-left leading-tight text-gray-800">
                        Risk
                      </th>
                      <th class="py-2 px-4 border-b-2 border-gray-300 text-left leading-tight text-gray-800">
                        Mitigation
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={risksAndMitigations()}>
                      {(item) => (
                        <tr>
                          <td class="py-2 px-4 border-b border-gray-300 text-gray-700">
                            {item.risk}
                          </td>
                          <td class="py-2 px-4 border-b border-gray-300 text-gray-700">
                            {item.mitigation}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
              <div class="flex space-x-4 mt-6">
                <button
                  class="flex-1 px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 cursor-pointer"
                  onClick={() => handleShareReport('email')}
                  disabled={sharing()}
                >
                  <Show when={sharing()}>Preparing to Share...</Show>
                  <Show when={!sharing()}>Share via Email</Show>
                </button>
                <button
                  class="flex-1 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 cursor-pointer"
                  onClick={() => handleShareReport('whatsapp')}
                  disabled={sharing()}
                >
                  <Show when={sharing()}>Preparing to Share...</Show>
                  <Show when={!sharing()}>Share via WhatsApp</Show>
                </button>
                <button
                  class="flex-1 px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 cursor-pointer"
                  onClick={handleExportToWord}
                >
                  Export to Word
                </button>
              </div>
            </Show>
          </Show>
        </div>
      </Show>
    </div>
  )
}

export default App