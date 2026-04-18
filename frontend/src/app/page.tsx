'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { API_BASE } from '@/lib/config'
import MainLayout from '@/components/MainLayout'
import ControlPanel from '@/components/ControlPanel'
import SlideViewer from '@/components/SlideViewer'
import ScriptEditor from '@/components/ScriptEditor'

interface Project {
  id: string
  filename: string
  fileType: string
  totalSlides: number
  fileSize: number
  uploadTimestamp: string
}

interface SavedScript {
  script: string
  wordCount: number
  duration: number
  savedAt: string
  status: 'draft' | 'completed'
  audioFile?: {
    filename: string
    voice: string
    speed: number
    fileSize: number
    generatedAt: string
  }
}

export default function Home() {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false)
  const [currentProject, setCurrentProject] = useState<Project | null>(null)
  const [currentSlide, setCurrentSlide] = useState(0)
  const [savedScripts, setSavedScripts] = useState<{[slideNumber: number]: SavedScript}>({})
  const [currentScript, setCurrentScript] = useState('')

  // Save script to server
  const handleSaveScript = async (script: string) => {
    if (!currentProject?.id) return

    const wordCount = script.trim().split(/\s+/).length
    const duration = Math.ceil(wordCount / 2.5)
    const slideNumber = currentSlide + 1

    try {
      await fetch(`${API_BASE}/api/script/save/${currentProject.id}/${slideNumber}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          script: script,
          word_count: wordCount,
          estimated_duration: duration
        }),
      })

      setSavedScripts(prev => ({
        ...prev,
        [slideNumber]: {
          ...prev[slideNumber],
          script,
          wordCount,
          duration,
          savedAt: new Date().toISOString(),
          status: 'completed' as const
        }
      }))

      setCurrentScript(script)
    } catch (error) {
      console.error('Failed to save script to server:', error)
      alert('Failed to save script. Please try again.')
    }
  }

  // Load scripts and audio from server for a project
  const loadProjectData = useCallback(async (projectId: string) => {
    const scripts: {[slideNumber: number]: SavedScript} = {}

    // Load scripts from server
    try {
      const res = await fetch(`${API_BASE}/api/script/list/${projectId}`)
      if (res.ok) {
        const result = await res.json()
        for (const item of result.scripts || []) {
          const slideNum = item.slide_number
          const meta = item.metadata || {}
          scripts[slideNum] = {
            script: meta.script || '',
            wordCount: meta.word_count || 0,
            duration: meta.estimated_duration || 0,
            savedAt: meta.saved_at || '',
            status: 'completed'
          }
        }
      }
    } catch (error) {
      console.error('Failed to load scripts:', error)
    }

    // Load audio files from server
    try {
      const res = await fetch(`${API_BASE}/api/voice/list/${projectId}`)
      if (res.ok) {
        const result = await res.json()
        for (const audioFile of result.audio_files || []) {
          const slideNum = audioFile.slide_number
          if (!scripts[slideNum]) {
            scripts[slideNum] = {
              script: '', wordCount: 0, duration: 0,
              savedAt: audioFile.generated_at || '', status: 'draft'
            }
          }
          scripts[slideNum].audioFile = {
            filename: audioFile.filename,
            voice: audioFile.voice,
            speed: audioFile.speed,
            fileSize: audioFile.file_size,
            generatedAt: audioFile.generated_at
          }
        }
      }
    } catch (error) {
      console.error('Failed to load audio files:', error)
    }

    setSavedScripts(scripts)
  }, [])

  const loadScriptAndNavigate = (slideNumber: number) => {
    if (window.AudioManager) {
      window.AudioManager.stopAll()
    } else if (window.stopAllAudio) {
      window.stopAllAudio()
    }

    const scriptData = savedScripts[slideNumber]
    setCurrentScript(scriptData?.script || '')
    setCurrentSlide(slideNumber - 1)
  }

  // Handle audio generation callback from ScriptEditor
  const handleAudioGenerated = (slideNumber: number, audioInfo: any) => {
    setSavedScripts(prev => ({
      ...prev,
      [slideNumber]: {
        ...prev[slideNumber],
        audioFile: {
          filename: audioInfo.filename,
          voice: audioInfo.voice,
          speed: audioInfo.speed,
          fileSize: audioInfo.fileSize,
          generatedAt: audioInfo.generatedAt
        }
      }
    }))
  }

  // Load project data when project changes
  useEffect(() => {
    if (currentProject?.id) {
      loadProjectData(currentProject.id)
    } else {
      setSavedScripts({})
    }
  }, [currentProject?.id, loadProjectData])

  // Update current script when slide changes
  useEffect(() => {
    const slideScript = savedScripts[currentSlide + 1]
    setCurrentScript(slideScript?.script || '')
  }, [currentSlide, savedScripts])

  // Resizable panels
  const [leftPanelWidth, setLeftPanelWidth] = useState(60)
  const [isResizing, setIsResizing] = useState(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsResizing(true)

    const container = document.getElementById('main-content-area')
    if (!container) return

    const containerRect = container.getBoundingClientRect()

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = ((e.clientX - containerRect.left) / containerRect.width) * 100
      const minRightPanelWidth = Math.max((400 / containerRect.width) * 100, 25)
      const maxLeftWidth = 100 - minRightPanelWidth
      const clampedWidth = Math.min(Math.max(newWidth, 30), maxLeftWidth)
      setLeftPanelWidth(clampedWidth)
    }

    const handleMouseUp = () => {
      setIsResizing(false)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      localStorage.setItem('leftPanelWidth', leftPanelWidth.toString())
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  useEffect(() => {
    const savedWidth = localStorage.getItem('leftPanelWidth')
    if (savedWidth) {
      setLeftPanelWidth(parseFloat(savedWidth))
    }
  }, [])

  return (
    <MainLayout>
      <div className="flex h-screen max-h-screen bg-gray-50">
        <ControlPanel
          isCollapsed={isPanelCollapsed}
          onToggle={() => setIsPanelCollapsed(!isPanelCollapsed)}
          currentProject={currentProject}
          onProjectChange={setCurrentProject}
        />

        <div id="main-content-area" className="flex-1 flex relative">
          <div
            className="min-w-0 flex flex-col overflow-y-auto"
            style={{ width: `${leftPanelWidth}%` }}
          >
            <SlideViewer
              currentSlide={currentSlide}
              onSlideChange={setCurrentSlide}
              project={currentProject}
              savedScripts={savedScripts}
              onScriptSelect={loadScriptAndNavigate}
            />
          </div>

          <div
            className={`w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0 transition-colors ${
              isResizing ? 'bg-blue-500' : ''
            }`}
            onMouseDown={handleMouseDown}
            title="Drag to resize panels"
          >
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-0.5 h-8 bg-white rounded-full opacity-50"></div>
            </div>
          </div>

          <div
            className="border-l border-gray-200 flex flex-col min-w-0 h-full overflow-y-auto"
            style={{ width: `${100 - leftPanelWidth}%` }}
          >
            <ScriptEditor
              currentSlide={currentSlide}
              project={currentProject}
              currentScript={currentScript}
              onScriptChange={setCurrentScript}
              onScriptSave={handleSaveScript}
              onAudioGenerated={handleAudioGenerated}
              existingAudioFile={(() => {
                const currentSlideScript = savedScripts[currentSlide + 1]
                if (currentSlideScript?.audioFile && currentProject?.id) {
                  return {
                    filename: currentSlideScript.audioFile.filename,
                    voice: currentSlideScript.audioFile.voice,
                    speed: currentSlideScript.audioFile.speed,
                    url: `/static/projects/${currentProject.id}/audio/${currentSlideScript.audioFile.filename}`
                  }
                }
                return undefined
              })()}
            />
          </div>
        </div>
      </div>
    </MainLayout>
  )
}
