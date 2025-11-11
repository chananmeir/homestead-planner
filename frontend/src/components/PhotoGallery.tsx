import React, { useState, useEffect } from 'react';

interface Photo {
  id: number;
  filename: string;
  filepath: string;
  caption?: string;
  category: string;
  gardenBedId?: number;
  uploadedAt: string;
}

const PhotoGallery: React.FC = () => {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null);

  useEffect(() => {
    loadPhotos();
  }, []);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch('http://localhost:5000/api/photos');
      const data = await response.json();
      setPhotos(data);
    } catch (error) {
      console.error('Error loading photos:', error);
    } finally {
      setLoading(false);
    }
  };

  const categories = ['all', 'garden', 'harvest', 'plants', 'progress', 'pest', 'disease', 'other'];

  const filteredPhotos = filterCategory === 'all'
    ? photos
    : photos.filter(photo => photo.category === filterCategory);

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

        {/* Controls */}
        <div className="flex flex-wrap gap-4 mb-6">
          <button className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors">
            Upload Photo
          </button>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {categories.map(cat => (
              <option key={cat} value={cat}>
                {cat === 'all' ? 'All Categories' : `${getCategoryIcon(cat)} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
              </option>
            ))}
          </select>
        </div>

        <p className="text-sm text-gray-500">
          Full upload and management functionality coming soon. Currently displaying photos from backend.
        </p>
      </div>

      {/* Photo Grid */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-800 mb-4">
          {filterCategory === 'all' ? 'All Photos' : `${filterCategory.charAt(0).toUpperCase() + filterCategory.slice(1)} Photos`}
        </h3>

        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
            <p className="mt-4 text-gray-600">Loading photos...</p>
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <div className="text-6xl mb-4">📷</div>
            <p className="text-lg">No photos yet.</p>
            <p className="text-sm mt-2">Start documenting your garden's progress by uploading photos!</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredPhotos.map((photo) => (
              <div
                key={photo.id}
                onClick={() => setSelectedPhoto(photo)}
                className="bg-white rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow cursor-pointer group"
              >
                <div className="aspect-square bg-gray-200 relative overflow-hidden">
                  <img
                    src={`http://localhost:5000${photo.filepath}`}
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
                  src={`http://localhost:5000${selectedPhoto.filepath}`}
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
                  <div>
                    {selectedPhoto.caption && (
                      <h3 className="text-xl font-bold text-gray-800 mb-2">{selectedPhoto.caption}</h3>
                    )}
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>{getCategoryIcon(selectedPhoto.category)} {selectedPhoto.category}</span>
                      <span>📅 {new Date(selectedPhoto.uploadedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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
