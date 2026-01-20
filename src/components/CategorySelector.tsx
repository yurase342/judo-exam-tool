/**
 * 科目（カテゴリ）選択コンポーネント
 */

import React from 'react';
import { CategoryId } from '../types';
import { CATEGORIES, CATEGORY_LIST, CategoryInfo } from '../config/categoryConfig';

interface CategorySelectorProps {
  selectedCategories: CategoryId[];
  onChange: (categories: CategoryId[]) => void;
  disabled?: boolean;
}

const CategorySelector: React.FC<CategorySelectorProps> = ({
  selectedCategories,
  onChange,
  disabled = false,
}) => {
  // 全選択/全解除
  const handleSelectAll = () => {
    if (selectedCategories.length === CATEGORY_LIST.length) {
      onChange([]);
    } else {
      onChange([...CATEGORY_LIST]);
    }
  };

  // 個別の科目を選択/解除
  const handleToggleCategory = (categoryId: CategoryId) => {
    const isCurrentlySelected = selectedCategories.includes(categoryId);
    const isAllSelected = selectedCategories.length === CATEGORY_LIST.length;

    // 全選択状態でクリックした場合 → その科目だけを選択
    if (isAllSelected && isCurrentlySelected) {
      onChange([categoryId]);
    } else if (isCurrentlySelected) {
      // 通常の解除
      onChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      // 通常の選択
      onChange([...selectedCategories, categoryId]);
    }
  };

  // 科目グループ（午前系・午後系）
  // 注意: judo_therapy（柔道整復理論）は午前・午後両方に含まれる
  // 午前のみの科目: 関係法規、解剖学、生理学、運動学、病理学概論
  // 午後のみの科目: 衛生学、リハビリテーション医学、一般臨床医学、外科学概論、整形外科学
  // 両方: 柔道整復理論
  const gozenCategories: CategoryId[] = ['judo_therapy', 'law', 'anatomy', 'physiology', 'kinesiology', 'pathology'];
  const gogoCategories: CategoryId[] = ['judo_therapy', 'hygiene', 'rehabilitation', 'clinical_general', 'surgery', 'orthopedics'];

  // グループ選択
  const handleSelectGozen = () => {
    const newSelection = new Set(selectedCategories);
    const allGozenSelected = gozenCategories.every(c => selectedCategories.includes(c));

    if (allGozenSelected) {
      gozenCategories.forEach(c => newSelection.delete(c));
    } else {
      gozenCategories.forEach(c => newSelection.add(c));
    }
    onChange(Array.from(newSelection));
  };

  const handleSelectGogo = () => {
    const newSelection = new Set(selectedCategories);
    const allGogoSelected = gogoCategories.every(c => selectedCategories.includes(c));

    if (allGogoSelected) {
      gogoCategories.forEach(c => newSelection.delete(c));
    } else {
      gogoCategories.forEach(c => newSelection.add(c));
    }
    onChange(Array.from(newSelection));
  };

  const isAllSelected = selectedCategories.length === CATEGORY_LIST.length;
  const isGozenAllSelected = gozenCategories.every(c => selectedCategories.includes(c));
  const isGogoAllSelected = gogoCategories.every(c => selectedCategories.includes(c));

  // 色のマッピング
  const getColorClasses = (category: CategoryInfo, isSelected: boolean) => {
    const baseColors: Record<string, { bg: string; border: string; text: string }> = {
      blue: { bg: 'bg-blue-100', border: 'border-blue-500', text: 'text-blue-700' },
      green: { bg: 'bg-green-100', border: 'border-green-500', text: 'text-green-700' },
      purple: { bg: 'bg-purple-100', border: 'border-purple-500', text: 'text-purple-700' },
      red: { bg: 'bg-red-100', border: 'border-red-500', text: 'text-red-700' },
      teal: { bg: 'bg-teal-100', border: 'border-teal-500', text: 'text-teal-700' },
      orange: { bg: 'bg-orange-100', border: 'border-orange-500', text: 'text-orange-700' },
      pink: { bg: 'bg-pink-100', border: 'border-pink-500', text: 'text-pink-700' },
      indigo: { bg: 'bg-indigo-100', border: 'border-indigo-500', text: 'text-indigo-700' },
      cyan: { bg: 'bg-cyan-100', border: 'border-cyan-500', text: 'text-cyan-700' },
      amber: { bg: 'bg-amber-100', border: 'border-amber-500', text: 'text-amber-700' },
      gray: { bg: 'bg-gray-100', border: 'border-gray-500', text: 'text-gray-700' },
    };

    const colors = baseColors[category.color] || baseColors.gray;

    if (isSelected) {
      return `${colors.bg} ${colors.border} ${colors.text} border-2`;
    }
    return 'bg-gray-50 border-gray-300 text-gray-500 border';
  };

  return (
    <div className={`space-y-4 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* クイック選択ボタン */}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSelectAll}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isAllSelected
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          {isAllSelected ? '全て選択中' : '全科目を選択'}
        </button>
        <button
          type="button"
          onClick={handleSelectGozen}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isGozenAllSelected
              ? 'bg-green-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          午前科目
        </button>
        <button
          type="button"
          onClick={handleSelectGogo}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            isGogoAllSelected
              ? 'bg-purple-600 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          午後科目
        </button>
      </div>

      {/* 科目リスト */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {CATEGORY_LIST.map(categoryId => {
          const category = CATEGORIES[categoryId];
          const isSelected = selectedCategories.includes(categoryId);

          return (
            <button
              key={categoryId}
              type="button"
              onClick={() => handleToggleCategory(categoryId)}
              className={`p-2 rounded-lg text-left transition-all ${getColorClasses(category, isSelected)}`}
            >
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => {}}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm font-medium">{category.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      {/* 全選択/全解除ボタン */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange([...CATEGORY_LIST])}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          全て選択
        </button>
        <span className="text-gray-300">|</span>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs text-blue-600 hover:text-blue-800 underline"
        >
          全て解除
        </button>
      </div>

      {/* 選択状態の表示 */}
      <div className="text-sm text-gray-600">
        {selectedCategories.length === 0 ? (
          <span className="text-orange-600">※ 科目を選択してください</span>
        ) : selectedCategories.length === CATEGORY_LIST.length ? (
          <span>全科目を選択中（クリックでその科目のみ選択）</span>
        ) : (
          <span>{selectedCategories.length}科目を選択中</span>
        )}
      </div>
    </div>
  );
};

export default CategorySelector;
