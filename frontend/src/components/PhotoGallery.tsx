import React, { useState, useEffect, useMemo } from 'react';
import { ConfirmDialog, useToast, SearchBar, SortDropdown, FilterBar, DateRangePicker } from './common';
import type { SortOption, SortDirection, FilterGroup, DateRange } from './common';
import { UploadPhotoModal } from './PhotoGallery/UploadPhotoModal';
import { EditPhotoModal } from './PhotoGallery/EditPhotoModal';

import { API_BASE_URL } from '../config';
interface Photo {
  id: number;
  filename: string;
  filepath: string;
  caption: string | null;
  category: string;
  gardenBedId: number | null;
  uploadedAt: string;
}

const PhotoGallery: React.FC = () => {
  const { showSuccess, showError } = useToast();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [photoToEdit, setPhotoToEdit] = useState<Photo | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState<Photo | null>(null);

  // Search, Filter, Sort state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: null, endDate: null });
  const [sortBy, setSortBy] = useState<string>('uploadedAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/api/photos`);
      const data = await response.json();
      setPhotos(data);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (photo: Photo) => {
    setPhotoToEdit(photo);
    setEditModalOpen(true);
    setSelectedPhoto(null); // Close lightbox
  };

  const handleDeleteClick = (photo: Photo) => {
    setPhotoToDelete(photo);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!photoToDelete) return;

    try {
      const response = await fetch(`${API_BASE_URL}/api/photos/${photoToDelete.id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        showSuccess('Photo deleted successfully!');
        loadPhotos(); // Refresh gallery
        setSelectedPhoto(null); // Close lightbox
        setPhotoToDelete(null);
      } else {
        showError('Failed to delete photo');
      }
    } catch (error) {
      showError('Network error occurred');
    }
  };

  // Filter and Sort Configuration
  const categories = ['garden', 'harvest', 'plants', 'progress', 'pest', 'disease', 'other'];

  const sortOptions: SortOption[] = [
    { value: 'uploadedAt', label: 'Upload Date' },
    { value: 'category', label: 'Category' },
    { value: 'caption', label: 'Caption' },
    { value: 'filename', label: 'Filename' },
  ];

  const filterGroups: FilterGroup[] = [
    {
      id: 'category',
      label: 'Category',
      options: categories.map(cat => ({
        value: cat,
        label: cat.charAt(0).toUpperCase() + cat.slice(1),
        count: photos.filter(p => p.category === cat).length,
      })),
    },
  ];

  const handleFilterChange = (groupId: string, values: string[]) => {
    setActiveFilters(prev => ({
      ...prev,
      [groupId]: values,
    }));
  };

  const handleClearAllFilters = () => {
    setActiveFilters({});
    setDateRange({ startDate: null, endDate: null });
  };

  const handleSortChange = (field: string, direction: SortDirection) => {
    setSortBy(field);
    setSortDirection(direction);
  };

  // Apply filters, search, date range, and sorting
  const filteredAndSortedPhotos = useMemo(() => {
    let result = [...photos];

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(photo => {
        const caption = photo.caption?.toLowerCase() || '';
        const filename = photo.filename.toLowerCase();
        return caption.includes(query) || filename.includes(query);
      });
    }

    // Category filters
    const categoryFilters = activeFilters['category'] || [];
    if (categoryFilters.length > 0) {
      result = result.filter(photo => categoryFilters.includes(photo.category));
    }

    // Date range filter
    if (dateRange.startDate || dateRange.endDate) {
      result = result.filter(photo => {
        const photoDate = new Date(photo.uploadedAt).toISOString().split('T')[0];

        if (dateRange.startDate && photoDate < dateRange.startDate) {
          return false;
        }
        if (dateRange.endDate && photoDate > dateRange.endDate) {
          return false;
        }
        return true;
      });
    }

    // Sorting
    result.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      switch (sortBy) {
        case 'uploadedAt':
          aValue = new Date(a.uploadedAt).getTime();
          bValue = new Date(b.uploadedAt).getTime();
          break;
        case 'category':
          aValue = a.category;
          bValue = b.category;
          break;
        case 'caption':
          aValue = a.caption?.toLowerCase() || '';
          bValue = b.caption?.toLowerCase() || '';
          break;
        case 'filename':
          aValue = a.filename.toLowerCase();
          bValue = b.filename.toLowerCase();
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [photos, searchQuery, activeFilters, dateRange, sortBy, sortDirection]);

  const getCategoryIcon = (category: string): string => {
    const icons: { [key: string]: string } = {
      garden: '🌱',
      harvest: '🧺',
      plants: '🌿',
      progress: '📈',
      pest: '🐛',
      disease: '🦠',
      other: '📷'
    };
    return icons[category] || '📷';
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">Photo Gallery</h2>
        <p className="text-gray-600 mb-6">
          Document your garden's progress with photos. Track plant development, harvests, and seasonal changes.
        </p>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 border border-blue-200">
            <div className="text-3xl font-bold text-blue-700 mb-2">{photos.length}</div>
            <div className="text-sm text-blue-600 font-medium">Total Photos</div>
          </div>

          {['garden', 'harvest', 'plants'].map(cat => {
            const count = photos.filter(p => p.category === cat).length;
            return (
              <div key={cat} className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-6 border border-green-200">
                <div className="text-2xl font-bold text-green-700 mb-2">
                  {getCategoryIcon(cat)} {count}
                </div>
                <div className="text-sm text-green-600 font-medium capitalize">{cat}</div>
              </div>
            );
          })}
        </div>

        {/* Upload Button */}
        <div className="mb-6">
          <button
            onClick={() => setUploadModalOpen(true)}
            className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium shadow-md hover:shadow-lg"
          >
            📤 Upload Photo
          </button>
        </div>

        {/* Search Bar */}
        <SearchBar
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search by caption or filename..."
          className="mb-4"
        />

        {/* Filters and Sort */}
        <div className="flex flex-wrap gap-4 items-start mb-6">
          <FilterBar
            filterGroups={filterGroups}
            activeFilters={activeFilters}
            onFilterChange={handleFilterChange}
            onClearAll={handleClearAllFilters}
          />

          <DateRangePicker
            value={dateRange}
            onChange={setDateRange}
            label="Upload Date"
          />

          <SortDropdown
            options={sortOptions}
            sortBy={sortBy}
            sortDirection={sortDirection}
            onSortChange={handleSortChange}
          />
        </div>
      </div>

      {/* Photo Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-bold text-gray-800">
            Photos {filteredAndSortedPhotos.length !== photos.length && `(${filteredAndSortedPhotos.length} of ${photos.length})`}
          </h3>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading photos...</p>
          </div>
        ) : filteredAndSortedPhotos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-lg">
              {photos.length === 0 ? 'No photos yet.' : 'No photos match your filters.'}
            </p>
            <p className="text-sm mt-2">
              {photos.length === 0
                ? 'Start documenting your garden\'s progress by uploading photos!'
                : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredAndSortedPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer group"
              >
                <div className="aspect-square bg-gray-200 relative overflow-hidden">
                  <img
                    src={`${API_BASE_URL}${photo.filepath}`}
                    alt={photo.caption || 'Garden photo'}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect fill="%23ddd" width="200" height="200"/%3E%3Ctext fill="%23999" x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif"%3ENo Image%3C/text%3E%3C/svg%3E';
                    }}
                  />
                  <div className="absolute top-2 right-2">
                    <span className="bg-white bg-opacity-90 px-2 py-1 rounded text-xs font-semibold">
                      {getCategoryIcon(photo.category)}
                    </span>
                  </div>
                </div>

                <div className="p-3">
                  {photo.caption && (
                    <p className="text-sm text-gray-800 font-medium line-clamp-2 mb-1">
                      {photo.caption}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    {new Date(photo.uploadedAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lightbox Modal */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="max-w-6xl max-h-full overflow-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-white rounded-lg overflow-hidden">
              <div className="relative">
                <img
                  src={`${API_BASE_URL}${selectedPhoto.filepath}`}
                  alt={selectedPhoto.caption || 'Garden photo'}
                  className="w-full max-h-[80vh] object-contain"
                />
                <button
                  onClick={() => setSelectedPhoto(null)}
                  className="absolute top-4 right-4 bg-white bg-opacity-90 hover:bg-opacity-100 text-gray-800 rounded-full p-2 shadow-lg"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {selectedPhoto.caption && (
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedPhoto.caption}</h3>
                    )}
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{getCategoryIcon(selectedPhoto.category)} {selectedPhoto.category}</span>
                      <span>📅 {new Date(selectedPhoto.uploadedAt).toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditClick(selectedPhoto);
                      }}
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center gap-2"
                      title="Edit photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteClick(selectedPhoto);
                      }}
                      className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium flex items-center gap-2"
                      title="Delete photo"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Upload Photo Modal */}
      <UploadPhotoModal
        isOpen={uploadModalOpen}
        onClose={() => setUploadModalOpen(false)}
        onSuccess={loadPhotos}
      />

      {/* Edit Photo Modal */}
      <EditPhotoModal
        isOpen={editModalOpen}
        onClose={() => setEditModalOpen(false)}
        photo={photoToEdit}
        onSuccess={loadPhotos}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setPhotoToDelete(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Delete Photo?"
        message="This photo will be permanently deleted from the gallery and cannot be recovered."
        confirmText="Delete"
        variant="danger"
      />

      {/* Info Card */}
      <div className="bg-purple-50 rounded-lg p-6 border border-purple-200">
        <h3 className="text-lg font-semibold text-purple-900 mb-2">Photo Documentation Tips</h3>
        <ul className="space-y-2 text-sm text-purple-800">
          <li>✓ Take photos from the same angle/position for consistent progress tracking</li>
          <li>✓ Include a ruler or common object for scale reference</li>
          <li>✓ Photograph problems (pests, diseases) to help identify and compare later</li>
          <li>✓ Document harvest yields and quality for yearly comparisons</li>
          <li>✓ Take weekly progress photos to create time-lapse sequences</li>
          <li>✓ Add detailed captions with dates, varieties, and growing conditions</li>
        </ul>
      </div>
    </div>
  );
};

export default PhotoGallery;
