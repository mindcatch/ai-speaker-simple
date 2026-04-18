'use client'

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { API_BASE } from '@/lib/config'

// Global Audio Manager
class AudioManager {
  static currentAudio: HTMLAudioElement | null = null
  static allAudioElements: Set<HTMLAudioElement> = new Set()

  static stopAll() {
    console.log('AudioManager: Stopping all audio')
    
    // Stop current tracked audio
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio.src = ''
      this.currentAudio.load()
      this.currentAudio = null
    }

    // Stop all tracked audio elements
    this.allAudioElements.forEach(audio => {
      try {
        audio.pause()
        audio.src = ''
        audio.load()
      } catch (error) {
        console.log('Error stopping audio element:', error)
      }
    })
    this.allAudioElements.clear()

    // Force stop any remaining audio elements in DOM
    document.querySelectorAll('audio').forEach(audio => {
      try {
        audio.pause()
        audio.src = ''
        audio.load()
      } catch (error) {
        console.log('Error stopping DOM audio element:', error)
      }
    })
  }

  static setCurrentAudio(audio: HTMLAudioElement) {
    // Stop all previous audio first
    this.stopAll()
    
    // Set new current audio
    this.currentAudio = audio
    this.allAudioElements.add(audio)
    console.log('AudioManager: Set new current audio')
  }

  static removeAudio(audio: HTMLAudioElement) {
    if (this.currentAudio === audio) {
      this.currentAudio = null
    }
    this.allAudioElements.delete(audio)
  }
}

// Global type declaration for window.stopAllAudio
declare global {
  interface Window {
    stopAllAudio?: () => void
    AudioManager?: typeof AudioManager
  }
}

interface ScriptEditorProps {
  currentSlide: number
  project: any
  currentScript?: string
  onScriptChange?: (script: string) => void
  onScriptSave?: (script: string) => void
  onAudioGenerated?: (slideNumber: number, audioInfo: any) => void
  existingAudioFile?: {
    filename: string
    voice: string
    speed: number
    url: string
  }
}

export default function ScriptEditor({ 
  currentSlide, 
  project, 
  currentScript = '',
  onScriptChange,
  onScriptSave,
  onAudioGenerated,
  existingAudioFile
}: ScriptEditorProps) {
  // Default instruction message for users
  const mockScript = `스크립트를 생성하고 수정하세요.

📝 스크립트 작성 방법:

1. 위의 "Generate Script" 버튼을 클릭하여 AI가 자동으로 스크립트를 생성하거나
2. 이 텍스트 영역에 직접 스크립트를 작성할 수 있습니다
3. 작성 완료 후 "Save" 버튼을 클릭하여 저장하세요

✨ 추가 기능:
• Smart Editing: 기존 스크립트를 AI가 개선해드립니다
• Generate Audio: 작성된 스크립트를 음성으로 변환합니다
• 다양한 음성과 속도 설정이 가능합니다

💡 팁: 생성된 스크립트는 언제든지 수정할 수 있으며, 슬라이드를 변경하면 해당 슬라이드의 스크립트가 자동으로 로드됩니다.`

  const [script, setScript] = useState(currentScript || mockScript)
  const [userContext, setUserContext] = useState('')
  const [isGeneratingScript, setIsGeneratingScript] = useState(false)
  const [selectedLength, setSelectedLength] = useState('Short (20-40s)')
  const [selectedStyle, setSelectedStyle] = useState('Academic')
  const [isSmartEditing, setIsSmartEditing] = useState(false)
  const [hasUserEdited, setHasUserEdited] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playbackProgress, setPlaybackProgress] = useState(0)
  const [selectedVoice, setSelectedVoice] = useState('us_standard')
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false)
  const [audioGenerated, setAudioGenerated] = useState(false)
  const [hasPlayableAudio, setHasPlayableAudio] = useState(false)  // 버튼 활성화용 (보존됨)
  const [latestAudioUrl, setLatestAudioUrl] = useState('')
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  
  // Ref for debouncing script changes
  const scriptChangeTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  // Ref for textarea element to preserve cursor position
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Ref to track if we're in composition (for IME input like Korean)
  const isComposingRef = useRef(false)

  // Update textarea directly when currentScript prop changes (Uncontrolled approach)
  useEffect(() => {
    if (currentScript !== undefined && !hasUserEdited && textareaRef.current) {
      textareaRef.current.value = currentScript
      setScript(currentScript) // Keep internal state in sync
    }
  }, [currentScript, hasUserEdited])

  // Reset hasUserEdited flag when slide changes
  useEffect(() => {
    setHasUserEdited(false)
  }, [currentSlide])

  // Initialize existing audio file state - NO AUTO LOADING
  useEffect(() => {
    console.log('Audio file info changed - updating state only (no loading)')
    
    // Complete audio cleanup first
    AudioManager.stopAll()
    setCurrentAudio(null)
    setIsPlaying(false)
    setPlaybackProgress(0)
    
    if (existingAudioFile) {
      console.log('Setting audio file info (no auto-loading):', existingAudioFile)
      // Only store file information - DO NOT load audio!
      setAudioGenerated(true)
      setHasPlayableAudio(true)  // 버튼 활성화용
      setLatestAudioUrl(existingAudioFile.url)
      setSelectedVoice(existingAudioFile.voice)
      setPlaybackSpeed(existingAudioFile.speed)
      // NO audio object creation or loading!
    } else {
      console.log('No existing audio file, complete reset')
      setAudioGenerated(false)
      setHasPlayableAudio(false)
      setLatestAudioUrl('')
    }
  }, [existingAudioFile])

  // Complete audio cleanup helper
  const completeAudioCleanup = useCallback(() => {
    AudioManager.stopAll()
    setCurrentAudio(null)
    setIsPlaying(false)
    setPlaybackProgress(0)
  }, [])

  // Cleanup audio when slide changes
  useEffect(() => {
    completeAudioCleanup()
  }, [currentSlide, completeAudioCleanup])

  // Register global audio cleanup function and AudioManager
  useEffect(() => {
    window.stopAllAudio = completeAudioCleanup
    window.AudioManager = AudioManager
    return () => {
      delete window.stopAllAudio
      delete window.AudioManager
    }
  }, [completeAudioCleanup])

  // Component unmount cleanup
  useEffect(() => {
    return () => {
      AudioManager.stopAll()
      if (scriptChangeTimeoutRef.current) {
        clearTimeout(scriptChangeTimeoutRef.current)
      }
    }
  }, [])

  // Handle script changes without cursor position issues (Uncontrolled approach)
  const handleScriptChange = useCallback((newScript: string) => {
    // No need to store/restore cursor position - DOM maintains it naturally
    setHasUserEdited(true) // Mark as user edited
    
    // Update internal script state for other functions
    setScript(newScript)
    
    // Debounced update to parent component (only if not composing)
    if (onScriptChange && !isComposingRef.current) {
      // Clear existing timeout
      if (scriptChangeTimeoutRef.current) {
        clearTimeout(scriptChangeTimeoutRef.current)
      }
      
      // Set new timeout for debounced update
      scriptChangeTimeoutRef.current = setTimeout(() => {
        onScriptChange(newScript)
      }, 500) // 500ms delay
    }
  }, [onScriptChange])

  // Handle composition events for IME input (Korean, Chinese, Japanese)
  const handleCompositionStart = useCallback(() => {
    isComposingRef.current = true
  }, [])

  const handleCompositionEnd = useCallback((e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false
    
    // Safe value access with fallbacks
    const value = e.currentTarget?.value ?? textareaRef.current?.value ?? script
    
    // Trigger debounced update after composition ends
    if (onScriptChange && value !== undefined) {
      if (scriptChangeTimeoutRef.current) {
        clearTimeout(scriptChangeTimeoutRef.current)
      }
      scriptChangeTimeoutRef.current = setTimeout(() => {
        onScriptChange(value)
      }, 500)
    }
  }, [onScriptChange, script])

  // Handle save button click using actual textarea value
  const handleSave = useCallback(() => {
    const currentText = textareaRef.current?.value || script
    if (onScriptSave && currentText.trim()) {
      onScriptSave(currentText)
      // Reset the user edited flag after successful save
      setHasUserEdited(false)
      alert('Script saved successfully!')
    } else if (!currentText.trim()) {
      alert('Please write a script before saving.')
    }
  }, [onScriptSave, script])

  // Memoize expensive calculations using actual textarea value
  const wordCount = useMemo(() => {
    const text = textareaRef.current?.value || script || mockScript
    return text.trim().split(/\s+/).filter(word => word.length > 0).length
  }, [script, mockScript])

  const estimatedTime = useMemo(() => {
    return Math.ceil(wordCount / 2.5) // ~150 words per minute
  }, [wordCount])

  // Memoize utility functions to prevent recreation on every render
  const getDurationFromLength = useCallback((length: string): number => {
    switch (length) {
      case 'Short (20-40s)': return 40
      case 'Medium (1 min)': return 60
      case 'Long (2-3min)': return 150
      default: return 60
    }
  }, [])

  const getStyleForAPI = useCallback((style: string): string => {
    switch (style) {
      case 'Academic': return 'academic'
      case 'Conversational': return 'conversational'
      case 'Enthusiastic': return 'enthusiastic'
      case 'Formal': return 'formal'
      default: return 'academic'
    }
  }, [])

  const handleGenerateScript = useCallback(async () => {
    if (!project?.id) {
      alert('Please upload a presentation first')
      return
    }

    setIsGeneratingScript(true)
    
    try {
      const response = await fetch(`${API_BASE}/api/script/generate-slide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: project.id,
          slide_number: currentSlide + 1,
          target_duration: getDurationFromLength(selectedLength),
          audience_level: 'general', // Could be made configurable later
          presentation_style: getStyleForAPI(selectedStyle),
          user_context: userContext.trim() || undefined
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const generatedScript = result.script || 'Script generation failed'
        
        // Update textarea directly (Uncontrolled approach)
        if (textareaRef.current) {
          textareaRef.current.value = generatedScript
        }
        setScript(generatedScript)
        
        // Mark as user edited to prevent overwriting when switching slides
        setHasUserEdited(true)
        // Update parent component with the generated script
        if (onScriptChange) {
          onScriptChange(generatedScript)
        }
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Generation failed' }))
        const errorMessage = `Error: ${errorData.detail}`
        if (textareaRef.current) {
          textareaRef.current.value = errorMessage
        }
        setScript(errorMessage)
      }
    } catch (error) {
      console.error('Script generation error:', error)
      setScript('Error: Failed to generate script. Please try again.')
    } finally {
      setIsGeneratingScript(false)
    }
  }, [project?.id, currentSlide, selectedLength, selectedStyle, userContext, getDurationFromLength, getStyleForAPI, onScriptChange])

  // Extract editing instructions from script text
  const extractEditingInstructions = (text: string): string[] => {
    const instructions = []
    const regex = /\[([^\]]+)\]/g
    let match
    
    while ((match = regex.exec(text)) !== null) {
      instructions.push(match[1])
    }
    
    return instructions
  }

  // Smart Editing function
  const handleSmartEditing = async () => {
    const currentText = textareaRef.current?.value || script || mockScript
    if (!currentText?.trim()) {
      alert('No script to edit')
      return
    }

    if (!project?.id) {
      alert('Please upload a presentation first')
      return
    }

    setIsSmartEditing(true)
    
    try {
      // Use userContext as primary editing instructions
      let instructions = []
      
      if (userContext.trim()) {
        // If user has provided context, use it as editing instruction
        instructions = [userContext.trim()]
        console.log('Using user context as editing instruction:', userContext.trim())
      } else {
        // Fallback to extracting [bracket] instructions from script
        instructions = extractEditingInstructions(currentText)
        console.log('Using bracket instructions from script:', instructions)
      }
      
      const response = await fetch(`${API_BASE}/api/script/edit-script`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          project_id: project.id,
          slide_number: currentSlide + 1,
          current_script: currentText,
          editing_instructions: instructions,
          target_duration: getDurationFromLength(selectedLength),
          presentation_style: getStyleForAPI(selectedStyle)
        }),
      })

      if (response.ok) {
        const result = await response.json()
        const improvedScript = result.improved_script || 'Script editing failed'
        
        // Update textarea directly (Uncontrolled approach)
        if (textareaRef.current) {
          textareaRef.current.value = improvedScript
        }
        setScript(improvedScript)
        
        // Update parent component with the improved script
        if (onScriptChange) {
          onScriptChange(improvedScript)
        }
        alert('Script improved successfully!')
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Editing failed' }))
        throw new Error(errorData.detail)
      }
    } catch (error) {
      console.error('Script editing error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Script editing failed: ${errorMessage}`)
    } finally {
      setIsSmartEditing(false)
    }
  }

  const extractScriptText = (text: string): string => {
    console.log('=== SCRIPT EXTRACTION DEBUG ===')
    console.log('Original text length:', text.length)
    console.log('Original text preview:', text.substring(0, 300) + '...')
    
    // First, try to parse as JSON
    try {
      const parsed = JSON.parse(text)
      console.log('Successfully parsed as JSON')
      console.log('JSON keys:', Object.keys(parsed))
      
      if (parsed && typeof parsed === 'object') {
        // Check for script field (most common)
        if (parsed.script && typeof parsed.script === 'string') {
          console.log('✅ Found script field')
          console.log('Script preview:', parsed.script.substring(0, 100) + '...')
          return parsed.script.trim()
        }
        
        // Check for improved_script field (from edit-script API)
        if (parsed.improved_script && typeof parsed.improved_script === 'string') {
          console.log('✅ Found improved_script field')
          console.log('Improved script preview:', parsed.improved_script.substring(0, 100) + '...')
          return parsed.improved_script.trim()
        }
        
        // Check for content field
        if (parsed.content && typeof parsed.content === 'string') {
          console.log('✅ Found content field')
          console.log('Content preview:', parsed.content.substring(0, 100) + '...')
          return parsed.content.trim()
        }
        
        console.log('❌ No recognized script field found in JSON')
        console.log('Available fields:', Object.keys(parsed))
      }
    } catch (e) {
      console.log('❌ Not valid JSON, trying text extraction')
    }
    
    // If JSON parsing failed, try to extract script from text patterns
    const scriptPatterns = [
      // Pattern 1: "script": "content"
      /"script"\s*:\s*"([^"]+)"/,
      // Pattern 2: 'script': 'content'
      /'script'\s*:\s*'([^']+)'/,
      // Pattern 3: script: content (without quotes, until next field)
      /script\s*:\s*([^,}]+)/,
    ]
    
    for (const pattern of scriptPatterns) {
      const match = text.match(pattern)
      if (match && match[1]) {
        console.log('✅ Found script using pattern matching')
        console.log('Extracted script preview:', match[1].substring(0, 100) + '...')
        return match[1].trim()
      }
    }
    
    // If still no script found, check if the entire text looks like a script
    const cleanText = text.trim()
    
    // If text doesn't contain JSON-like structure, treat as plain script
    if (!cleanText.includes('{') && !cleanText.includes('"script"')) {
      console.log('✅ Using entire text as script (no JSON structure detected)')
      console.log('Final script preview:', cleanText.substring(0, 100) + '...')
      return cleanText
    }
    
    // Last resort: return original text
    console.log('⚠️ Using original text as fallback')
    console.log('Final text preview:', cleanText.substring(0, 100) + '...')
    console.log('===============================')
    return cleanText
  }

  const handleGenerateAudio = async () => {
    const currentText = textareaRef.current?.value || script || mockScript
    if (!currentText?.trim()) {
      alert('No script to generate audio from')
      return
    }

    if (!project?.id) {
      alert('Please upload a presentation first')
      return
    }

    setIsGeneratingAudio(true)
    setAudioGenerated(false)

    // Clean up previous audio to prevent stale playback
    AudioManager.stopAll()
    setCurrentAudio(null)
    setIsPlaying(false)
    setPlaybackProgress(0)

    try {
      const textToSpeak = extractScriptText(currentText)
      console.log('Generating audio for text:', textToSpeak.substring(0, 100) + '...')

      const response = await fetch(`${API_BASE}/api/voice/synthesize/${project.id}/${currentSlide + 1}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: textToSpeak,  // Send only the clean script text
          voice: selectedVoice,
          speed: playbackSpeed,
          force_regenerate: true  // Always generate new audio
        }),
      })

      if (response.ok) {
        const result = await response.json()
        console.log('Audio generated successfully')
        const cacheBustedUrl = `${result.audio_url}?t=${Date.now()}`
        setLatestAudioUrl(cacheBustedUrl)
        setAudioGenerated(true)
        setHasPlayableAudio(true)

        if (onAudioGenerated) {
          const filename = result.audio_url.split('/').pop()
          onAudioGenerated(currentSlide + 1, {
            filename: filename,
            voice: selectedVoice,
            speed: playbackSpeed,
            fileSize: result.file_size || 0,
            generatedAt: new Date().toISOString()
          })
        }

        alert('Audio generated successfully! You can now play it.')
      } else {
        const errorData = await response.json().catch(() => ({ detail: 'Audio generation failed' }))
        throw new Error(errorData.detail)
      }
    } catch (error) {
      console.error('Audio generation error:', error)
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
      alert(`Audio generation failed: ${errorMessage}`)
    } finally {
      setIsGeneratingAudio(false)
    }
  }

  // Play/Pause toggle function
  const handlePlayPause = async () => {
    // Debug logging
    console.log('=== PLAY BUTTON DEBUG ===')
    console.log('currentSlide:', currentSlide)
    console.log('isPlaying:', isPlaying)
    console.log('currentAudio:', currentAudio)
    console.log('hasPlayableAudio:', hasPlayableAudio)
    console.log('existingAudioFile:', existingAudioFile)
    console.log('audioGenerated:', audioGenerated)
    console.log('latestAudioUrl:', latestAudioUrl)
    console.log('project:', project)
    console.log('========================')

    if (isPlaying) {
      // Currently playing → Pause (no conditions needed for pause)
      if (currentAudio) {
        console.log('Pausing audio')
        currentAudio.pause()
        setIsPlaying(false)
      } else {
        // Edge case: isPlaying is true but no currentAudio
        console.log('Fixing inconsistent state: isPlaying true but no currentAudio')
        setIsPlaying(false)
      }
      return // Exit after pause
    }

    // Currently stopped/paused → Play/Resume (check conditions only for play)
    if (!hasPlayableAudio && !existingAudioFile) {
      alert('Please generate audio first using the "Generate Audio" button!')
      return
    }

    if (currentAudio && currentAudio.src) {
      // Resume existing audio that was paused
      console.log('Resuming paused audio')
      try {
        await currentAudio.play()
        setIsPlaying(true)
      } catch (error) {
        console.error('Resume failed, starting fresh:', error)
        AudioManager.stopAll()
        setCurrentAudio(null)
        // Fall through to start new playback below
      }
      if (isPlaying) return
    }

    {
      // Start new audio playback
      console.log('Starting new audio playback')
      try {
        let audioUrl = latestAudioUrl
        
        // If no latestAudioUrl but existingAudioFile exists, use that
        if (!audioUrl && existingAudioFile) {
          audioUrl = existingAudioFile.url
        }
        
        if (!audioUrl) {
          throw new Error('No audio URL available')
        }
        
        const filename = audioUrl.split('/').pop()?.split('?')[0]
        
        // Check if audioUrl is already a full URL
        const isFullUrl = audioUrl.startsWith('http')
        const cacheBuster = `?t=${Date.now()}`
        const urls = [
          `${API_BASE}/api/voice/audio-file/${project.id}/${filename}${cacheBuster}`,
          isFullUrl ? audioUrl : `${API_BASE}${audioUrl}`
        ]

        let playbackSuccess = false
        for (const url of urls) {
          try {
            console.log(`Trying to play: ${url}`)
            await playAudioFile(url)
            playbackSuccess = true
            break
          } catch (error) {
            console.log(`Failed to play ${url}:`, error)
          }
        }
        
        if (!playbackSuccess) {
          throw new Error('All playback methods failed')
        }
      } catch (error) {
        console.error('Audio playback error:', error)
        setIsPlaying(false)
        setPlaybackProgress(0)
        const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
        alert(`Audio playback failed: ${errorMessage}`)
      }
    }
  }

  const handleStop = () => {
    console.log('Stopping - returning to initial state')
    
    if (currentAudio) {
      // Stop playback immediately
      currentAudio.pause()
      
      // Completely remove audio object (avoid currentTime manipulation)
      currentAudio.src = ''
      currentAudio.load()
      setCurrentAudio(null)
    }
    
    // Return to initial state (preserve file info for reuse)
    setIsPlaying(false)
    setPlaybackProgress(0)
    
    console.log('Returned to initial state - ready for fresh playback')
  }

  const playAudioFile = async (audioUrl: string) => {
    return new Promise<void>((resolve, reject) => {
      console.log('Loading and playing audio:', audioUrl)
      
      const audio = new Audio()
      
      // Use AudioManager to manage this audio
      AudioManager.setCurrentAudio(audio)
      setCurrentAudio(audio)
      
      // Create named functions for event listeners (easier to remove)
      const updateProgress = () => {
        if (audio.duration) {
          const progress = (audio.currentTime / audio.duration) * 100
          setPlaybackProgress(progress)
        }
      }

      const handleLoadedData = () => {
        console.log('Audio data loaded successfully')
      }

      const handleCanPlayThrough = () => {
        console.log('Audio ready - starting playback now (user clicked Play)')
        audio.playbackRate = playbackSpeed || 1.0
        audio.play()
          .then(() => {
            console.log('Audio playback started successfully')
            setIsPlaying(true)
            resolve() // Resolve when playback starts successfully
          })
          .catch((playError) => {
            console.error('Audio play() failed:', playError)
            cleanupAudio()
            reject(new Error(`Audio play failed: ${playError.message}`))
          })
      }
      
      const handleEnded = () => {
        console.log('Audio playback ended')
        AudioManager.removeAudio(audio)
        setIsPlaying(false)
        setPlaybackProgress(0)
        setCurrentAudio(null)
        cleanupAudio()
        // Don't resolve here - already resolved when playback started
      }

      const handleError = (e: Event) => {
        // Check if this is a real error or just a harmless browser event
        const isRealError = audio.error && 
                           audio.error.code > 0 && 
                           audio.networkState !== 3 && // Not NETWORK_NO_SOURCE
                           audio.readyState !== 4 // Not HAVE_ENOUGH_DATA
        
        if (isRealError) {
          console.log('=== REAL AUDIO ERROR ===')
          console.log('Event type:', e.type)
          console.log('Audio URL:', audioUrl)
          console.log('Network state:', audio.networkState)
          console.log('Ready state:', audio.readyState)
          console.log('Error code:', audio.error.code)
          console.log('Error message:', audio.error.message)
          console.log('========================')
          
          AudioManager.removeAudio(audio)
          cleanupAudio()
          reject(new Error(`Audio load failed: ${audio.error.message || 'Unknown error'}`))
        } else {
          // Harmless browser event - just log briefly and ignore
          console.log(`Audio event (${e.type}) - harmless, ignoring`)
          // Don't reject or cleanup for harmless events
        }
      }

      // Cleanup function to remove all event listeners
      const cleanupAudio = () => {
        try {
          audio.removeEventListener('timeupdate', updateProgress)
          audio.removeEventListener('ended', handleEnded)
          audio.removeEventListener('error', handleError)
          audio.removeEventListener('loadeddata', handleLoadedData)
          audio.removeEventListener('canplaythrough', handleCanPlayThrough)
          
          setIsPlaying(false)
          setPlaybackProgress(0)
          setCurrentAudio(null)
        } catch (error) {
          console.error('Error during audio cleanup:', error)
        }
      }

      // Set up event listeners with named functions
      audio.addEventListener('loadeddata', handleLoadedData)
      audio.addEventListener('canplaythrough', handleCanPlayThrough)
      audio.addEventListener('timeupdate', updateProgress)
      audio.addEventListener('ended', handleEnded)
      audio.addEventListener('error', handleError)

      // Set source and load (but don't play yet)
      audio.src = audioUrl
      audio.load()
    })
  }

  // Format time helper function
  const formatTime = (seconds: number): string => {
    if (!seconds || isNaN(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Interactive progress bar handlers
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!currentAudio || !currentAudio.duration) return
    
    const progressBar = e.currentTarget
    const rect = progressBar.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const percentage = Math.max(0, Math.min(100, (clickX / rect.width) * 100))
    const newTime = (percentage / 100) * currentAudio.duration
    
    console.log(`Seeking to ${formatTime(newTime)} (${percentage.toFixed(1)}%)`)
    currentAudio.currentTime = newTime
    setPlaybackProgress(percentage)
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    handleProgressClick(e)
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) {
      handleProgressClick(e)
    }
    
    // Show hover time
    if (currentAudio?.duration) {
      const rect = e.currentTarget.getBoundingClientRect()
      const hoverX = e.clientX - rect.left
      const percentage = Math.max(0, Math.min(100, (hoverX / rect.width) * 100))
      const time = (percentage / 100) * currentAudio.duration
      setHoverTime(time)
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleMouseLeave = () => {
    setHoverTime(null)
    setIsDragging(false)
  }

  // Add global mouse up listener for dragging
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mouseup', handleGlobalMouseUp)
      return () => document.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging])

  return (
    <div className="flex flex-col bg-white min-w-0 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">Script Editor</h2>
          <div className="flex items-center space-x-4 text-sm text-gray-500">
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              <span>{wordCount} words</span>
            </div>
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{estimatedTime}s</span>
            </div>
            <div className="flex items-center space-x-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <span>Intermediate</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Undo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
            </svg>
          </button>
          <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100" title="Redo">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 10h-10a8 8 0 00-8 8v2m18-10l-6-6m6 6l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Generation Controls */}
      <div className="p-4 border-b border-gray-200 bg-gray-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-800 font-medium">Length:</label>
              <select 
                value={selectedLength}
                onChange={(e) => setSelectedLength(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-800"
              >
                <option>Short (20-40s)</option>
                <option>Medium (1 min)</option>
                <option>Long (2-3min)</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-800 font-medium">Style:</label>
              <select 
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="px-2 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 text-gray-800"
              >
                <option>Academic</option>
                <option>Conversational</option>
                <option>Enthusiastic</option>
                <option>Formal</option>
              </select>
            </div>
          </div>
          
          <button
            onClick={handleGenerateScript}
            disabled={isGeneratingScript}
            className="px-4 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isGeneratingScript ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
                <span>Generate Script</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Script Editor */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 p-4 min-h-0">
            <textarea
              ref={textareaRef}
              defaultValue={script || mockScript}
              onChange={(e) => handleScriptChange(e.target.value)}
              onCompositionStart={handleCompositionStart}
              onCompositionEnd={handleCompositionEnd}
              placeholder="Your generated script will appear here..."
              className="w-full h-full min-h-[400px] max-w-full px-4 pt-4 pb-48 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none font-serif text-base leading-relaxed text-gray-800 placeholder-gray-400 overflow-y-auto"
            />
          </div>
          
          {/* Request for re-generation & editing */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Request for re-generation & editing
              </label>
              <textarea
                value={userContext}
                onChange={(e) => setUserContext(e.target.value)}
                placeholder="Add specific request or emphasis for editting this script..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none text-gray-900 placeholder-gray-500"
                rows={2}
              />
            </div>
            
            {/* Script Actions - Smart Editing & Save */}
            <div className="flex items-center justify-end space-x-2">
              <button
                onClick={handleSmartEditing}
                disabled={isSmartEditing}
                className="px-4 py-2 bg-purple-600 text-white text-xs rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[120px]"
              >
                {isSmartEditing ? 'Editing...' : 'Smart Editing'}
              </button>
              
              <button 
                onClick={handleSave}
                className="px-4 py-2 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 transition-colors min-w-[120px]"
              >
                Save
              </button>
            </div>
          </div>
          
          {/* Audio Generation Section */}
          <div className="p-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <select 
                  value={selectedVoice}
                  onChange={(e) => setSelectedVoice(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-gray-800"
                >
                  <option value="us_standard">🇺🇸 US (Standard)</option>
                  <option value="uk_formal">🇬🇧 UK (Formal)</option>
                  <option value="au_friendly">🇦🇺 AU (Friendly)</option>
                  <option value="us_deep">🇺🇸 US (Deep)</option>
                  <option value="ca_neutral">🇨🇦 CA (Neutral)</option>
                  <option value="us_energetic">🇺🇸 US (Energetic)</option>
                </select>
                
                <button
                  onClick={handleGenerateAudio}
                  disabled={isGeneratingAudio}
                  className="px-4 py-2 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[120px]"
                >
                  {isGeneratingAudio ? 'Generating...' : 'Generate Audio'}
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Voice Controls */}
      <div className="border-t border-gray-200 p-6 bg-gray-50 flex-shrink-0">
        <h4 className="font-medium text-gray-900 mb-4">🎵 Voice Play</h4>
        
        {/* Speed Control Only */}
        <div className="flex items-center justify-end mb-4">
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">Speed:</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.25" 
              value={playbackSpeed || 1.0}
              onChange={(e) => {
                const newSpeed = parseFloat(e.target.value)
                setPlaybackSpeed(newSpeed)
                if (currentAudio) {
                  currentAudio.playbackRate = newSpeed
                }
              }}
              className="w-24"
            />
            <span className="text-sm text-gray-600 min-w-[3rem]">{playbackSpeed}x</span>
          </div>
        </div>
        
        {/* Audio Control Buttons - Play/Pause + Download */}
        <div className="flex items-center space-x-3 mb-4">
          {/* Play/Pause Toggle Button */}
          <button
            onClick={handlePlayPause}
            disabled={!hasPlayableAudio && !existingAudioFile}
            className={`px-4 py-2 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[100px] ${
              isPlaying 
                ? 'bg-yellow-600 hover:bg-yellow-700' 
                : 'bg-green-600 hover:bg-green-700'
            }`}
            title={isPlaying ? "Pause playbook" : "Start/Resume playback"}
          >
            {isPlaying ? 'Pause' : 'Play'}
          </button>

        </div>

        {/* Interactive Progress Bar with Time Display */}
        <div className="flex items-center space-x-3">
          {/* Current Time */}
          <span className="text-xs text-gray-500 min-w-[3rem] font-mono">
            {currentAudio ? formatTime(currentAudio.currentTime) : '0:00'}
          </span>
          
          {/* Interactive Progress Bar */}
          <div 
            className="flex-1 relative cursor-pointer group"
            onClick={handleProgressClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            {/* Background Bar */}
            <div className="w-full bg-gray-200 rounded-full h-3 group-hover:h-4 transition-all duration-200">
              {/* Progress Bar */}
              <div 
                className="bg-green-600 h-full rounded-full transition-all duration-100 relative"
                style={{ width: `${playbackProgress}%` }}
              >
                {/* Drag Handle */}
                <div className="absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-green-600 rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" />
              </div>
            </div>
            
            {/* Hover Time Tooltip */}
            {hoverTime !== null && (
              <div 
                className="absolute top-[-2.5rem] bg-black text-white text-xs px-2 py-1 rounded pointer-events-none z-10"
                style={{ 
                  left: `${Math.max(0, Math.min(100, (hoverTime / (currentAudio?.duration || 1)) * 100))}%`,
                  transform: 'translateX(-50%)'
                }}
              >
                {formatTime(hoverTime)}
              </div>
            )}
          </div>
          
          {/* Total Duration */}
          <span className="text-xs text-gray-500 min-w-[3rem] font-mono">
            {currentAudio ? formatTime(currentAudio.duration) : '0:00'}
          </span>
        </div>
      </div>
    </div>
  )
}
