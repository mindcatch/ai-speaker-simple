'use client'

import { useState } from 'react'
import { API_BASE } from '@/lib/config'

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

interface SlideViewerProps {
  currentSlide: number
  onSlideChange: (slideIndex: number) => void
  project: any
  savedScripts?: {[slideNumber: number]: SavedScript}
  onScriptSelect?: (slideNumber: number) => void
}

export default function SlideViewer({
  currentSlide,
  onSlideChange,
  project,
  savedScripts = {},
  onScriptSelect,
}: SlideViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [zoomLevel, setZoomLevel] = useState(100)
  const [thumbnailStartIndex, setThumbnailStartIndex] = useState(0)
  
  const THUMBNAILS_PER_PAGE = 5

  // Generate slides array based on project totalSlides
  const totalSlides = project?.totalSlides || 5
  const slides = Array.from({ length: totalSlides }, (_, index) => ({
    id: index + 1,
    title: `Slide ${index + 1}`,
    type: index === 0 ? 'title' : index === totalSlides - 1 ? 'conclusion' : 'content',
    duration: 60,
    hasScript: false
  }))

  const currentSlideData = slides[currentSlide] || slides[0]
  const hasRealProject = project && project.id && project.totalSlides > 0


  const handlePrevSlide = () => {
    if (currentSlide > 0) {
      onSlideChange(currentSlide - 1)
    }
  }

  const handleNextSlide = () => {
    if (currentSlide < slides.length - 1) {
      onSlideChange(currentSlide + 1)
    }
  }

  const scrollThumbnailsLeft = () => {
    const newIndex = Math.max(0, thumbnailStartIndex - THUMBNAILS_PER_PAGE)
    setThumbnailStartIndex(newIndex)
    console.log('Scroll left:', thumbnailStartIndex, '->', newIndex)
  }

  const scrollThumbnailsRight = () => {
    const maxStart = Math.max(0, slides.length - THUMBNAILS_PER_PAGE)
    const newIndex = Math.min(maxStart, thumbnailStartIndex + THUMBNAILS_PER_PAGE)
    setThumbnailStartIndex(newIndex)
    console.log('Scroll right:', thumbnailStartIndex, '->', newIndex)
  }

  // Get visible thumbnails
  const visibleThumbnails = slides.slice(
    thumbnailStartIndex, 
    thumbnailStartIndex + THUMBNAILS_PER_PAGE
  )

  const handleZoomIn = () => {
    setZoomLevel(Math.min(zoomLevel + 25, 200))
  }

  const handleZoomOut = () => {
    setZoomLevel(Math.max(zoomLevel - 25, 50))
  }

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {slides[currentSlide]?.title || `Slide ${currentSlide + 1}`}
          </h2>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4V2a1 1 0 011-1h8a1 1 0 011 1v2h4a1 1 0 011 1v1a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1h4z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8v12a2 2 0 002 2h10a2 2 0 002-2V8" />
            </svg>
            <span>{currentSlide + 1} of {slides.length}</span>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>~{slides[currentSlide]?.duration || 60}s</span>
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium ${
            slides[currentSlide]?.type === 'title' ? 'bg-blue-100 text-blue-800' :
            slides[currentSlide]?.type === 'methodology' ? 'bg-purple-100 text-purple-800' :
            slides[currentSlide]?.type === 'results' ? 'bg-green-100 text-green-800' :
            slides[currentSlide]?.type === 'conclusion' ? 'bg-orange-100 text-orange-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {slides[currentSlide]?.type || 'content'}
          </div>
        </div>
        
        <div className="flex items-center space-x-2 relative z-10">
          <button 
            onClick={handleZoomOut}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Zoom Out"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
            </svg>
          </button>
          <span className="text-sm text-gray-500 min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button 
            onClick={handleZoomIn}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Zoom In"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
            </svg>
          </button>
          <button 
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            title="Fullscreen"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Slide Display */}
      <div className="flex-1 flex items-center justify-center p-2 bg-gray-50 relative">
        {/* Slide Container */}
        <div 
          className="relative bg-white shadow-lg rounded-lg overflow-hidden max-w-full max-h-full"
          style={{ 
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'center center',
            width: 'min(100%, 800px)',
            height: 'min(calc(90vh - 200px), 600px)',
            aspectRatio: '4/3',
            zIndex: 1
          }}
        >
          {/* Actual slide content or placeholder */}
          {hasRealProject && project.id ? (
            <img
              key={`slide-${project.id}-${currentSlide}`}
              src={`${API_BASE}/static/projects/${project.id}/slides/slide_${String(currentSlide + 1).padStart(3, '0')}.png`}
              alt={`Slide ${currentSlide + 1}`}
              className="w-full h-full object-contain bg-white"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          ) : null}

          {/* Placeholder slide content (only when no project) */}
          <div className={`w-full h-full flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100`} style={{ display: hasRealProject ? 'none' : 'flex' }}>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-800 mb-2">
                {hasRealProject ? currentSlideData?.title || `Slide ${currentSlide + 1}` : 'Upload Presentation'}
              </h3>
              <p className="text-gray-600">
                {hasRealProject ? 'Loading slide...' : 'Slide content will appear here after upload'}
              </p>
            </div>
          </div>
          
          {/* Navigation Overlay */}
          <div className="absolute inset-0 flex items-center justify-between p-4 opacity-0 hover:opacity-100 transition-opacity">
            <button
              onClick={handlePrevSlide}
              disabled={currentSlide === 0}
              className="p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            
            <button
              onClick={handleNextSlide}
              disabled={currentSlide === slides.length - 1}
              className="p-3 bg-black bg-opacity-50 text-white rounded-full hover:bg-opacity-70 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Thumbnail Strip with Pagination */}
      <div className="border-t border-gray-200 p-4">
        <div className="flex items-center space-x-3">
          {/* Left scroll button */}
          <button 
            onClick={scrollThumbnailsLeft}
            disabled={thumbnailStartIndex === 0}
            className="p-2 rounded-lg bg-white border-2 border-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 shadow-md"
            title="Previous thumbnails"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          {/* Thumbnail container */}
          <div className="flex space-x-2 flex-1 justify-center">
            {visibleThumbnails.map((slide, index) => {
              const actualIndex = thumbnailStartIndex + index
              return (
                <button
                  key={slide.id}
                  onClick={() => onSlideChange(actualIndex)}
                  className={`flex-shrink-0 relative group ${
                    actualIndex === currentSlide 
                      ? 'ring-2 ring-blue-500' 
                      : 'hover:ring-2 hover:ring-gray-300'
                  }`}
                >
                  <div className="w-20 h-15 bg-gradient-to-br from-gray-100 to-gray-200 rounded border overflow-hidden">
                    {hasRealProject ? (
                      <img
                        src={`${API_BASE}/static/projects/${project.id}/slides/slide_${String(actualIndex + 1).padStart(3, '0')}.png`}
                        alt={`Slide ${actualIndex + 1}`}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          // Fallback to slide number if image fails to load
                          e.currentTarget.style.display = 'none'
                          const fallback = e.currentTarget.nextElementSibling as HTMLElement
                          if (fallback) fallback.style.display = 'flex'
                        }}
                      />
                    ) : null}
                    <div className={`w-full h-full flex items-center justify-center ${hasRealProject ? 'hidden' : ''}`}>
                      <span className="text-xs text-gray-500">{actualIndex + 1}</span>
                    </div>
                  </div>
                  
                  {/* Status indicators */}
                  <div className="absolute -top-1 -right-1 flex space-x-1">
                    {slide.hasScript && (
                      <div className="w-3 h-3 bg-green-500 rounded-full border border-white" title="Has script" />
                    )}
                  </div>
                  
                  {/* Slide info tooltip */}
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-black text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                    {slide.title}
                  </div>
                </button>
              )
            })}
          </div>
          
          {/* Right scroll button */}
          <button 
            onClick={scrollThumbnailsRight}
            disabled={thumbnailStartIndex + THUMBNAILS_PER_PAGE >= slides.length}
            className="p-2 rounded-lg bg-white border-2 border-blue-500 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 shadow-md"
            title="Next thumbnails"
          >
            <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
        
        {/* Page indicator */}
        <div className="text-center mt-2 text-xs text-gray-500">
          {thumbnailStartIndex + 1}-{Math.min(thumbnailStartIndex + THUMBNAILS_PER_PAGE, slides.length)} of {slides.length}
        </div>
      </div>

      {/* Script Table - Always visible */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-sm font-medium text-gray-700">📝 Slide Scripts</h4>
          <span className="text-xs text-gray-500">{Object.keys(savedScripts).length} saved</span>
        </div>
        
        {/* Table Container with proper scrolling */}
        <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
          {/* Fixed Header */}
          <div className="bg-gray-50 border-b border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">Slide</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-16">Words</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">Duration</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">Audio</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-24">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-gray-700 w-20">Saved</th>
                </tr>
              </thead>
            </table>
          </div>
          
          {/* Scrollable Body */}
          <div 
            className="bg-white" 
            style={{ 
              height: '200px', 
              overflowY: 'scroll',
              border: '1px solid #e5e7eb',
              borderTop: 'none'
            }}
          >
            <table className="w-full text-sm">
              <tbody>
                {Object.keys(savedScripts).length > 0 ? (
                  Object.entries(savedScripts)
                    .sort(([a], [b]) => parseInt(a) - parseInt(b))
                    .map(([slideNum, scriptData]) => (
                    <tr 
                      key={slideNum} 
                      className={`border-t hover:bg-blue-50 cursor-pointer transition-colors ${
                        parseInt(slideNum) === currentSlide + 1 ? 'bg-blue-100' : 'bg-white'
                      }`}
                      onClick={() => onScriptSelect && onScriptSelect(parseInt(slideNum))}
                    >
                      <td className="px-3 py-2 font-medium text-gray-900 w-20">Slide {slideNum}</td>
                      <td className="px-3 py-2 text-gray-600 w-16">{scriptData.wordCount}</td>
                      <td className="px-3 py-2 text-gray-600 w-20">{scriptData.duration}s</td>
                      <td className="px-3 py-2 w-20">
                        {scriptData.audioFile ? (
                          <div 
                            className="flex items-center space-x-1 text-xs text-green-600 font-medium"
                            title={`Voice: ${scriptData.audioFile.voice}, Speed: ${scriptData.audioFile.speed}x`}
                          >
                            <span>🎵 Ready</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">⚪ None</span>
                        )}
                      </td>
                      <td className="px-3 py-2 w-24">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          scriptData.status === 'completed' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {scriptData.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 w-20">
                        {new Date(scriptData.savedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7} className="px-3 py-8 text-center text-gray-500">
                      <div className="flex flex-col items-center">
                        <svg className="w-8 h-8 text-gray-300 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <p className="text-sm font-medium">No scripts saved yet</p>
                        <p className="text-xs text-gray-400 mt-1">
                          Create and save scripts to see them here
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 text-center">
          {Object.keys(savedScripts).length > 0 
            ? "Click on a row to load script and navigate to slide"
            : "Scripts will appear here after you save them from the Script Editor"
          }
        </div>
      </div>
    </div>
  )
}
