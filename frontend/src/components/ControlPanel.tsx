'use client'

import { useState, useRef, useEffect } from 'react'
import { API_BASE } from '@/lib/config'

interface ControlPanelProps {
  isCollapsed: boolean
  onToggle: () => void
  currentProject: any
  onProjectChange: (project: any) => void
}

interface ExistingProject {
  project_id: string
  filename: string
  created_at: string
  total_slides: number
  analysis_complete: boolean
}

export default function ControlPanel({
  isCollapsed,
  onToggle,
  currentProject,
  onProjectChange
}: ControlPanelProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [analysisStatus, setAnalysisStatus] = useState<string>('')
  const [existingProjects, setExistingProjects] = useState<ExistingProject[]>([])
  const [showExistingProjects, setShowExistingProjects] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load existing projects on component mount
  useEffect(() => {
    fetchExistingProjects()
  }, [])

  const fetchExistingProjects = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/upload/projects`)
      if (response.ok) {
        const data = await response.json()
        setExistingProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Failed to fetch existing projects:', error)
    }
  }

  const handleLoadProject = async (projectId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/upload/project/${projectId}`)
      if (response.ok) {
        const data = await response.json()
        const projectData = {
          id: projectId,
          filename: data.metadata.original_filename,
          totalSlides: data.metadata.total_slides,
          fileSize: data.metadata.file_size,
          fileType: data.metadata.file_type,
          uploadTimestamp: data.metadata.created_at
        }
        onProjectChange(projectData)
        setAnalysisStatus('Project loaded successfully! ✅')
        setTimeout(() => setAnalysisStatus(''), 2000)
      }
    } catch (error) {
      console.error('Failed to load project:', error)
      setAnalysisStatus('Failed to load project')
      setTimeout(() => setAnalysisStatus(''), 3000)
    }
  }

  const handleDeleteProject = async (projectId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}"?`)) {
      return
    }

    try {
      const response = await fetch(`${API_BASE}/api/upload/project/${projectId}`, {
        method: 'DELETE'
      })
      if (response.ok) {
        setExistingProjects(prev => prev.filter(p => p.project_id !== projectId))
        if (currentProject?.id === projectId) {
          onProjectChange(null)
        }
        setAnalysisStatus('Project deleted successfully! ✅')
        setTimeout(() => setAnalysisStatus(''), 2000)
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
      setAnalysisStatus('Failed to delete project')
      setTimeout(() => setAnalysisStatus(''), 3000)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleBrowseFiles = () => {
    fileInputRef.current?.click()
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length > 0) {
      handleFileUpload(files)
    }
  }

  const handleFileUpload = async (files: File[]) => {
    setIsUploading(true)
    setUploadProgress(0)
    setAnalysisStatus('Uploading...')

    const sessionId = Math.random().toString(36).substring(2, 15)

    try {
      const file = files[0]
      const formData = new FormData()
      formData.append('files', file)

      // Phase 1: Upload with real progress tracking (0-70%)
      const uploadResult = await new Promise<any>((resolve, reject) => {
        const xhr = new XMLHttpRequest()

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const percent = Math.round((e.loaded / e.total) * 70)
            setUploadProgress(percent)
            if (percent < 70) {
              setAnalysisStatus(`Uploading... ${Math.round(e.loaded / 1024 / 1024 * 10) / 10}MB / ${Math.round(e.total / 1024 / 1024 * 10) / 10}MB`)
            }
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(JSON.parse(xhr.responseText))
          } else {
            try {
              const err = JSON.parse(xhr.responseText)
              reject(new Error(err.detail || 'Upload failed'))
            } catch {
              reject(new Error('Upload failed'))
            }
          }
        }

        xhr.onerror = () => reject(new Error('Network error'))
        xhr.ontimeout = () => reject(new Error('Upload timed out'))
        xhr.timeout = 5 * 60 * 1000

        xhr.open('POST', `${API_BASE}/api/upload/file/${sessionId}`)
        xhr.send(formData)
      })

      // Phase 2: Server processing (70-85%)
      setUploadProgress(75)
      setAnalysisStatus('Processing slides...')

      // Phase 3: Loading project (85-100%)
      setUploadProgress(85)
      setAnalysisStatus('Loading project...')
      await fetchExistingProjects()
      await handleLoadProject(uploadResult.file_id)

      setUploadProgress(100)
      setAnalysisStatus('Upload complete!')

      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setAnalysisStatus('')
      }, 2000)

    } catch (error) {
      console.error('Upload/Analysis error:', error)
      setAnalysisStatus('Error occurred. Please try again.')
      setTimeout(() => {
        setIsUploading(false)
        setUploadProgress(0)
        setAnalysisStatus('')
      }, 3000)
    }
  }

  const handleUploadSlides = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className={`bg-white border-r border-gray-200 transition-all duration-300 ${
      isCollapsed ? 'w-16' : 'w-80'
    } flex flex-col`}>
      {/* Toggle Button */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-1/2 transform -translate-y-1/2 w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 z-10"
      >
        <svg 
          className={`w-3 h-3 text-gray-400 transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      {!isCollapsed && (
        <div className="flex-1 overflow-y-auto">
          {/* Project Section */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 1v6" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 1v6" />
              </svg>
              <h3 className="text-sm font-semibold text-gray-700">Project</h3>
            </div>
            
            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
                isDragOver 
                  ? 'border-blue-400 bg-blue-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <svg className="w-8 h-8 text-gray-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-600 mb-2">
                Drop slides here or
              </p>
              <button 
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                onClick={handleBrowseFiles}
              >
                Browse Files
              </button>
              <p className="text-xs text-gray-500 mt-1">
                PPTX, PDF, PNG, JPG (max 100MB)
              </p>
            </div>

            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pptx,.pdf,.png,.jpg,.jpeg"
              onChange={handleFileInputChange}
              className="hidden"
            />

            {/* Upload Progress */}
            {isUploading && (
              <div className="mt-3 p-3 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-between text-sm text-blue-700 mb-2">
                  <span>{analysisStatus}</span>
                  <span>{uploadProgress}%</span>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300" 
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            <div className="mt-3 space-y-2">
              <button 
                className={`w-full px-3 py-2 text-sm rounded-lg transition-colors ${
                  isUploading 
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
                onClick={handleUploadSlides}
                disabled={isUploading}
              >
                {isUploading ? 'Uploading...' : 'Upload Slides'}
              </button>
            </div>

            {/* Existing Projects - Always show section */}
            <div className="mt-3">
              <button
                onClick={() => setShowExistingProjects(!showExistingProjects)}
                className="w-full flex items-center justify-between p-2 text-sm bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <span className="font-medium text-gray-700">
                  📁 Existing Projects ({existingProjects.length})
                </span>
                <svg 
                  className={`w-4 h-4 text-gray-500 transition-transform ${showExistingProjects ? 'rotate-180' : ''}`}
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showExistingProjects && (
                <div className="mt-2 space-y-2 max-h-48 overflow-y-auto">
                  {existingProjects.length > 0 ? (
                    existingProjects.map((project) => (
                      <div key={project.project_id} className="p-2 bg-white border border-gray-200 rounded-lg">
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-gray-900 truncate">
                              {project.filename}
                            </p>
                            <p className="text-xs text-gray-500">
                              {project.total_slides} slides • {new Date(project.created_at).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleLoadProject(project.project_id)}
                            className="flex-1 px-2 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleDeleteProject(project.project_id, project.filename)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-600 rounded hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-3 text-center text-xs text-gray-500 bg-gray-50 rounded-lg">
                      No existing projects found
                      <br />
                      <span className="text-xs text-gray-400">Upload a presentation to get started</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Current Project Info */}
            {currentProject && (
              <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center space-x-2 mb-2">
                  <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h4 className="text-sm font-semibold text-green-800">Current Project</h4>
                </div>
                <div className="space-y-1 text-xs text-green-700">
                  <div className="flex items-center space-x-1">
                    <span>📄</span>
                    <span className="truncate">{currentProject.filename}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>📊</span>
                    <span>{currentProject.totalSlides} slides</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>💾</span>
                    <span>{(currentProject.fileSize / (1024 * 1024)).toFixed(1)} MB</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <span>✅</span>
                    <span>Ready to use</span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  )
}
