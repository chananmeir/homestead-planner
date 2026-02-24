import React, { useState, useEffect } from 'react';
import { CompostPile } from '../types';
import { format, addDays, differenceInDays } from 'date-fns';
import { apiGet, apiPost, apiPut, apiDelete } from '../utils/api';

const CompostTracker: React.FC = () => {
  const [compostPiles, setCompostPiles] = useState<CompostPile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddPile, setShowAddPile] = useState(false);
  const [showIngredientForm, setShowIngredientForm] = useState<number | null>(null);

  const [newPile, setNewPile] = useState({
    name: '',
    location: '',
    width: 3,
    length: 3,
    height: 3,
  });

  const [newIngredient, setNewIngredient] = useState({
    material: '',
    amount: 0,
  });

  // Load compost piles from backend on mount
  useEffect(() => {
    loadCompostPiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadCompostPiles = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiGet('/api/compost-piles');

      if (!response.ok) {
        throw new Error('Failed to load compost piles');
      }

      const data = await response.json();

      // Convert ISO date strings to Date objects
      const pilesWithDates = data.map((pile: any) => ({
        ...pile,
        startDate: new Date(pile.startDate),
        lastTurned: pile.lastTurned ? new Date(pile.lastTurned) : undefined,
        estimatedReadyDate: new Date(pile.estimatedReadyDate),
        turnSchedule: generateTurnSchedule(), // Frontend-only feature
        ingredients: pile.ingredients.map((ing: any) => ({
          ...ing,
          addedDate: new Date(ing.addedDate)
        }))
      }));

      setCompostPiles(pilesWithDates);
    } catch (err) {
      console.error('Error loading compost piles:', err);
      setError('Failed to load compost piles');
    } finally {
      setLoading(false);
    }
  };

  const addCompostPile = async () => {
    if (!newPile.name || !newPile.location) return;

    try {
      setError(null);

      const response = await apiPost('/api/compost-piles', {
        name: newPile.name,
        location: newPile.location,
        size: {
          width: newPile.width,
          length: newPile.length,
          height: newPile.height
        }
      });

      if (!response.ok) {
        throw new Error('Failed to create compost pile');
      }

      const savedPile = await response.json();

      // Convert dates and add to local state
      const pileWithDates = {
        ...savedPile,
        startDate: new Date(savedPile.startDate),
        estimatedReadyDate: new Date(savedPile.estimatedReadyDate),
        lastTurned: savedPile.lastTurned ? new Date(savedPile.lastTurned) : undefined,
        turnSchedule: generateTurnSchedule(), // Frontend-only feature
        ingredients: []
      };

      setCompostPiles([...compostPiles, pileWithDates]);
      setShowAddPile(false);
      setNewPile({ name: '', location: '', width: 3, length: 3, height: 3 });
    } catch (err) {
      console.error('Error creating compost pile:', err);
      setError('Failed to create compost pile');
    }
  };

  const generateTurnSchedule = (): Date[] => {
    // Turn every 7 days for the first month, then every 14 days
    const schedule: Date[] = [];
    const today = new Date();

    for (let i = 1; i <= 4; i++) {
      schedule.push(addDays(today, i * 7));
    }
    for (let i = 1; i <= 4; i++) {
      schedule.push(addDays(today, 28 + i * 14));
    }

    return schedule;
  };

  const addIngredient = async (pileId: string | number) => {
    if (!newIngredient.material || newIngredient.amount <= 0) return;

    try {
      setError(null);

      // Backend recalculates C:N ratio automatically
      const response = await apiPost(`/api/compost-piles/${pileId}/ingredients`, {
        material: newIngredient.material,
        amount: newIngredient.amount
      });

      if (!response.ok) {
        throw new Error('Failed to add ingredient');
      }

      const updatedPile = await response.json();

      // Update local state with full pile returned from backend
      setCompostPiles(
        compostPiles.map((pile) =>
          pile.id === pileId ? {
            ...updatedPile,
            startDate: new Date(updatedPile.startDate),
            lastTurned: updatedPile.lastTurned ? new Date(updatedPile.lastTurned) : undefined,
            estimatedReadyDate: new Date(updatedPile.estimatedReadyDate),
            turnSchedule: pile.turnSchedule, // Preserve client-side schedule
            ingredients: updatedPile.ingredients.map((ing: any) => ({
              ...ing,
              addedDate: new Date(ing.addedDate)
            }))
          } : pile
        )
      );

      setShowIngredientForm(null);
      setNewIngredient({ material: '', amount: 0 });
    } catch (err) {
      console.error('Error adding ingredient:', err);
      setError('Failed to add ingredient');
    }
  };

  const markPileTurned = async (pileId: string | number) => {
    try {
      setError(null);

      const response = await apiPut(`/api/compost-piles/${pileId}`, {
        lastTurned: true  // Backend interprets this as "set to now"
      });

      if (!response.ok) {
        throw new Error('Failed to mark pile as turned');
      }

      const updatedPile = await response.json();

      // Update local state
      setCompostPiles(
        compostPiles.map((pile) =>
          pile.id === pileId ? {
            ...updatedPile,
            startDate: new Date(updatedPile.startDate),
            lastTurned: new Date(updatedPile.lastTurned),
            estimatedReadyDate: new Date(updatedPile.estimatedReadyDate),
            turnSchedule: pile.turnSchedule, // Preserve client-side schedule
            ingredients: updatedPile.ingredients.map((ing: any) => ({
              ...ing,
              addedDate: new Date(ing.addedDate)
            }))
          } : pile
        )
      );
    } catch (err) {
      console.error('Error marking pile as turned:', err);
      setError('Failed to mark pile as turned');
    }
  };

  const updatePileStatus = async (pileId: string | number, status: CompostPile['status']) => {
    try {
      setError(null);

      const response = await apiPut(`/api/compost-piles/${pileId}`, {
        status
      });

      if (!response.ok) {
        throw new Error('Failed to update pile status');
      }

      const updatedPile = await response.json();

      // Update local state
      setCompostPiles(
        compostPiles.map((pile) =>
          pile.id === pileId ? {
            ...updatedPile,
            startDate: new Date(updatedPile.startDate),
            lastTurned: updatedPile.lastTurned ? new Date(updatedPile.lastTurned) : undefined,
            estimatedReadyDate: new Date(updatedPile.estimatedReadyDate),
            turnSchedule: pile.turnSchedule, // Preserve client-side schedule
            ingredients: updatedPile.ingredients.map((ing: any) => ({
              ...ing,
              addedDate: new Date(ing.addedDate)
            }))
          } : pile
        )
      );
    } catch (err) {
      console.error('Error updating pile status:', err);
      setError('Failed to update pile status');
    }
  };

  const updateMoisture = async (pileId: string | number, moisture: CompostPile['moisture']) => {
    try {
      setError(null);

      const response = await apiPut(`/api/compost-piles/${pileId}`, {
        moisture
      });

      if (!response.ok) {
        throw new Error('Failed to update moisture level');
      }

      const updatedPile = await response.json();

      // Update local state
      setCompostPiles(
        compostPiles.map((pile) =>
          pile.id === pileId ? {
            ...updatedPile,
            startDate: new Date(updatedPile.startDate),
            lastTurned: updatedPile.lastTurned ? new Date(updatedPile.lastTurned) : undefined,
            estimatedReadyDate: new Date(updatedPile.estimatedReadyDate),
            turnSchedule: pile.turnSchedule, // Preserve client-side schedule
            ingredients: updatedPile.ingredients.map((ing: any) => ({
              ...ing,
              addedDate: new Date(ing.addedDate)
            }))
          } : pile
        )
      );
    } catch (err) {
      console.error('Error updating moisture:', err);
      setError('Failed to update moisture level');
    }
  };

  const deletePile = async (pileId: string | number) => {
    try {
      setError(null);

      const response = await apiDelete(`/api/compost-piles/${pileId}`);

      if (!response.ok) {
        throw new Error('Failed to delete pile');
      }

      // Update local state
      setCompostPiles(compostPiles.filter((pile) => pile.id !== pileId));
    } catch (err) {
      console.error('Error deleting pile:', err);
      setError('Failed to delete pile');
    }
  };

  const getCNRatioColor = (ratio: number) => {
    if (ratio >= 25 && ratio <= 35) return 'text-green-600';
    if (ratio >= 20 && ratio <= 40) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getCNRatioStatus = (ratio: number) => {
    if (ratio >= 25 && ratio <= 35) return 'Ideal';
    if (ratio >= 20 && ratio <= 40) return 'Good';
    if (ratio < 20) return 'Too much nitrogen (wet, smelly)';
    return 'Too much carbon (slow)';
  };

  // Loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">
            ♻️ Compost Tracker
          </h2>
          <p className="text-gray-600">Loading compost piles...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4">
          ♻️ Compost Tracker
        </h2>
        <p className="text-gray-600">
          Manage your compost piles, track ingredients, and maintain the perfect
          carbon-to-nitrogen ratio for fast, efficient composting.
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <span className="text-red-800 font-semibold">Error:</span>
            <span className="text-red-700">{error}</span>
          </div>
          <button
            onClick={() => {
              setError(null);
              loadCompostPiles();
            }}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )}

      {/* Add Pile Button */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <button
          onClick={() => setShowAddPile(!showAddPile)}
          className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          data-testid="btn-add-pile"
        >
          {showAddPile ? 'Cancel' : '+ Add Compost Pile'}
        </button>

        {showAddPile && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg border">
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pile Name
                  </label>
                  <input
                    type="text"
                    value={newPile.name}
                    onChange={(e) =>
                      setNewPile({ ...newPile, name: e.target.value })
                    }
                    placeholder="e.g., Main Pile, Kitchen Scraps"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Location
                  </label>
                  <input
                    type="text"
                    value={newPile.location}
                    onChange={(e) =>
                      setNewPile({ ...newPile, location: e.target.value })
                    }
                    placeholder="e.g., Back corner, Near shed"
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Pile Size (feet)
                </label>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-600">Width</label>
                    <input
                      type="number"
                      value={newPile.width}
                      onChange={(e) =>
                        setNewPile({ ...newPile, width: Number(e.target.value) })
                      }
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Length</label>
                    <input
                      type="number"
                      value={newPile.length}
                      onChange={(e) =>
                        setNewPile({ ...newPile, length: Number(e.target.value) })
                      }
                      min="1"
                      max="10"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Height</label>
                    <input
                      type="number"
                      value={newPile.height}
                      onChange={(e) =>
                        setNewPile({ ...newPile, height: Number(e.target.value) })
                      }
                      min="1"
                      max="6"
                      className="w-full px-3 py-2 border rounded-lg"
                    />
                  </div>
                </div>
              </div>

              <button
                onClick={addCompostPile}
                disabled={!newPile.name || !newPile.location}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                data-testid="btn-create-pile"
              >
                Create Pile
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Compost Piles */}
      {compostPiles.length === 0 ? (
        <div className="bg-white rounded-lg shadow-md p-12 text-center">
          <p className="text-gray-500">
            No compost piles yet. Create your first pile to start tracking!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {compostPiles.map((pile) => (
            <div key={pile.id} data-testid={`compost-pile-${pile.id}`} className="bg-white rounded-lg shadow-md p-6">
              {/* Pile Header */}
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-xl font-semibold text-gray-800">
                    {pile.name}
                  </h3>
                  <p className="text-sm text-gray-600">
                    {pile.location} • Started{' '}
                    {format(pile.startDate, 'MMM d, yyyy')}
                  </p>
                  <p className="text-sm text-gray-600">
                    Size: {pile.size.width}' × {pile.size.length}' ×{' '}
                    {pile.size.height}'
                  </p>
                </div>
                <div className="flex gap-2">
                  <select
                    value={pile.status}
                    onChange={(e) =>
                      updatePileStatus(pile.id, e.target.value as CompostPile['status'])
                    }
                    className="px-3 py-1 border rounded-lg text-sm"
                    data-testid={`pile-status-${pile.id}`}
                  >
                    <option value="building">Building</option>
                    <option value="cooking">Cooking</option>
                    <option value="curing">Curing</option>
                    <option value="ready">Ready</option>
                  </select>
                  <button
                    onClick={() => deletePile(pile.id)}
                    className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    data-testid={`btn-delete-pile-${pile.id}`}
                  >
                    Delete
                  </button>
                </div>
              </div>

              {/* C:N Ratio */}
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-semibold text-gray-700">
                      Carbon:Nitrogen Ratio
                    </h4>
                    <p className="text-sm text-gray-600">Ideal: 25-35:1</p>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-3xl font-bold ${getCNRatioColor(
                        pile.carbonNitrogenRatio
                      )}`}
                      data-testid={`pile-cn-ratio-${pile.id}`}
                    >
                      {pile.carbonNitrogenRatio.toFixed(1)}:1
                    </div>
                    <p className="text-sm text-gray-600">
                      {getCNRatioStatus(pile.carbonNitrogenRatio)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Moisture & Temperature */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Moisture Level
                  </label>
                  <select
                    value={pile.moisture}
                    onChange={(e) =>
                      updateMoisture(pile.id, e.target.value as CompostPile['moisture'])
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  >
                    <option value="dry">Too Dry</option>
                    <option value="ideal">Ideal (like a wrung sponge)</option>
                    <option value="wet">Too Wet</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Turned
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={
                        pile.lastTurned
                          ? format(pile.lastTurned, 'MMM d, yyyy')
                          : 'Never'
                      }
                      readOnly
                      className="flex-1 px-3 py-2 border rounded-lg bg-gray-50"
                    />
                    <button
                      onClick={() => markPileTurned(pile.id)}
                      className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Turn Now
                    </button>
                  </div>
                </div>
              </div>

              {/* Ingredients */}
              <div className="mb-4">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="font-semibold text-gray-700">
                    Ingredients ({pile.ingredients.length})
                  </h4>
                  <button
                    onClick={() =>
                      setShowIngredientForm(
                        showIngredientForm === pile.id ? null : pile.id
                      )
                    }
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                  >
                    {showIngredientForm === pile.id ? 'Cancel' : '+ Add Material'}
                  </button>
                </div>

                {showIngredientForm === pile.id && (
                  <div className="mb-3 p-3 bg-gray-50 rounded border">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Material
                        </label>
                        <select
                          value={newIngredient.material}
                          onChange={(e) =>
                            setNewIngredient({
                              ...newIngredient,
                              material: e.target.value,
                            })
                          }
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        >
                          <option value="">Select material...</option>
                          <optgroup label="Green (Nitrogen)">
                            <option value="grass-clippings">Grass Clippings</option>
                            <option value="food-scraps">Food Scraps</option>
                            <option value="coffee-grounds">Coffee Grounds</option>
                            <option value="fresh-manure">Fresh Manure</option>
                            <option value="hay-fresh">Fresh Hay</option>
                          </optgroup>
                          <optgroup label="Brown (Carbon)">
                            <option value="dried-leaves">Dried Leaves</option>
                            <option value="straw">Straw</option>
                            <option value="wood-chips">Wood Chips</option>
                            <option value="cardboard">Cardboard</option>
                            <option value="paper">Paper</option>
                            <option value="sawdust">Sawdust</option>
                          </optgroup>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Amount (cubic feet)
                        </label>
                        <input
                          type="number"
                          value={newIngredient.amount || ''}
                          onChange={(e) =>
                            setNewIngredient({
                              ...newIngredient,
                              amount: Number(e.target.value),
                            })
                          }
                          min="0"
                          step="0.5"
                          className="w-full px-3 py-2 border rounded-lg text-sm"
                        />
                      </div>
                    </div>
                    <button
                      onClick={() => addIngredient(pile.id)}
                      disabled={
                        !newIngredient.material || newIngredient.amount <= 0
                      }
                      className="mt-2 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                    >
                      Add
                    </button>
                  </div>
                )}

                <div className="space-y-2">
                  {pile.ingredients.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-4">
                      No materials added yet
                    </p>
                  ) : (
                    pile.ingredients.map((ingredient, index) => (
                      <div
                        key={index}
                        className="flex justify-between items-center p-2 bg-gray-50 rounded"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 text-xs rounded ${
                              ingredient.type === 'green'
                                ? 'bg-green-100 text-green-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {ingredient.type}
                          </span>
                          <span className="text-sm font-medium text-gray-700">
                            {ingredient.name.replace(/-/g, ' ')}
                          </span>
                        </div>
                        <div className="text-sm text-gray-600">
                          {ingredient.amount} cu ft • C:N {ingredient.carbonNitrogenRatio}
                          :1
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Ready Date */}
              <div className="p-3 bg-blue-50 rounded border border-blue-200">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-blue-900">
                    Estimated Ready Date
                  </span>
                  <span className="text-sm text-blue-800">
                    {format(pile.estimatedReadyDate, 'MMM d, yyyy')} (
                    {differenceInDays(pile.estimatedReadyDate, new Date())} days)
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Composting Tips */}
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <h3 className="font-semibold text-green-900 mb-3">
          ♻️ Composting Best Practices
        </h3>
        <ul className="text-sm text-green-800 space-y-2">
          <li>
            • <strong>C:N Ratio:</strong> Aim for 25-35:1. Too much nitrogen
            (low ratio) causes odor. Too much carbon (high ratio) slows
            decomposition.
          </li>
          <li>
            • <strong>Moisture:</strong> Should feel like a wrung-out sponge. Add
            water if too dry, add dry browns if too wet.
          </li>
          <li>
            • <strong>Aeration:</strong> Turn pile every 7-14 days to add oxygen and
            speed decomposition.
          </li>
          <li>
            • <strong>Temperature:</strong> Active piles heat to 130-160°F, killing
            weed seeds and pathogens.
          </li>
          <li>
            • <strong>Size:</strong> Minimum 3'×3'×3' for proper heat generation.
          </li>
          <li>
            • <strong>Timeline:</strong> Hot compost: 3-4 months. Cold compost: 6-12
            months.
          </li>
        </ul>
      </div>
    </div>
  );
};

export default CompostTracker;
