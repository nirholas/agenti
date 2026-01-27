/**
 * SchemaForm Component - Dynamic form generation from JSON Schema
 * @copyright 2024-2026 nirholas
 * @license MIT
 */

'use client';

import * as React from 'react';
import { useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { JsonSchema, JsonSchemaProperty } from './types';

export interface SchemaFormProps {
  /** JSON Schema defining the form structure */
  schema: JsonSchema;
  /** Current form values */
  value: Record<string, unknown>;
  /** Callback when values change */
  onChange: (value: Record<string, unknown>) => void;
  /** Whether the form is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
}

interface FieldProps {
  name: string;
  property: JsonSchemaProperty;
  value: unknown;
  onChange: (value: unknown) => void;
  required: boolean;
  disabled: boolean;
  path: string;
}

/**
 * Render a single schema field based on its type
 */
function SchemaField({
  name,
  property,
  value,
  onChange,
  required,
  disabled,
  path,
}: FieldProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const fieldId = `${path}-${name}`;

  // String field
  if (property.type === 'string') {
    // Enum select
    if (property.enum && property.enum.length > 0) {
      return (
        <div className="space-y-1.5">
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-neutral-300"
          >
            {name}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {property.description && (
            <p className="text-xs text-neutral-500">{property.description}</p>
          )}
          <select
            id={fieldId}
            value={(value as string) || (property.default as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className={cn(
              'w-full h-11 px-4 py-2 rounded-xl border bg-black text-white text-sm',
              'focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-neutral-600',
              disabled && 'opacity-50 cursor-not-allowed',
              'border-neutral-700'
            )}
          >
            <option value="">Select {name}...</option>
            {property.enum.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );
    }

    // Long text (textarea)
    const isLongText =
      property.format === 'textarea' ||
      (property.maxLength && property.maxLength > 200) ||
      name.toLowerCase().includes('body') ||
      name.toLowerCase().includes('content') ||
      name.toLowerCase().includes('description');

    if (isLongText) {
      return (
        <div className="space-y-1.5">
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-neutral-300"
          >
            {name}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {property.description && (
            <p className="text-xs text-neutral-500">{property.description}</p>
          )}
          <textarea
            id={fieldId}
            value={(value as string) || ''}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            placeholder={`Enter ${name}...`}
            className={cn(
              'w-full min-h-[100px] px-4 py-2 rounded-xl border bg-black text-white text-sm resize-y',
              'placeholder:text-neutral-500',
              'focus:outline-none focus:ring-2 focus:ring-white/10 focus:border-neutral-600',
              disabled && 'opacity-50 cursor-not-allowed',
              'border-neutral-700'
            )}
          />
        </div>
      );
    }

    // Regular string input
    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-neutral-300"
        >
          {name}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {property.description && (
          <p className="text-xs text-neutral-500">{property.description}</p>
        )}
        <Input
          id={fieldId}
          type={property.format === 'password' ? 'password' : 'text'}
          value={(value as string) || ''}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={`Enter ${name}...`}
        />
      </div>
    );
  }

  // Number field
  if (property.type === 'number' || property.type === 'integer') {
    return (
      <div className="space-y-1.5">
        <label
          htmlFor={fieldId}
          className="block text-sm font-medium text-neutral-300"
        >
          {name}
          {required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {property.description && (
          <p className="text-xs text-neutral-500">{property.description}</p>
        )}
        <Input
          id={fieldId}
          type="number"
          value={value !== undefined ? String(value) : ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              onChange(undefined);
            } else {
              onChange(
                property.type === 'integer' ? parseInt(val, 10) : parseFloat(val)
              );
            }
          }}
          disabled={disabled}
          placeholder={`Enter ${name}...`}
          min={property.minimum}
          max={property.maximum}
          step={property.type === 'integer' ? 1 : 'any'}
        />
      </div>
    );
  }

  // Boolean field
  if (property.type === 'boolean') {
    return (
      <div className="flex items-start gap-3">
        <input
          id={fieldId}
          type="checkbox"
          checked={Boolean(value)}
          onChange={(e) => onChange(e.target.checked)}
          disabled={disabled}
          className={cn(
            'mt-1 w-4 h-4 rounded border-neutral-600 bg-black text-green-500',
            'focus:ring-2 focus:ring-white/10',
            disabled && 'opacity-50 cursor-not-allowed'
          )}
        />
        <div>
          <label
            htmlFor={fieldId}
            className="block text-sm font-medium text-neutral-300 cursor-pointer"
          >
            {name}
            {required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {property.description && (
            <p className="text-xs text-neutral-500">{property.description}</p>
          )}
        </div>
      </div>
    );
  }

  // Array field
  if (property.type === 'array') {
    const arrayValue = Array.isArray(value) ? value : [];
    const itemType = property.items?.type || 'string';

    const addItem = () => {
      const defaultValue =
        itemType === 'string'
          ? ''
          : itemType === 'number' || itemType === 'integer'
          ? 0
          : itemType === 'boolean'
          ? false
          : itemType === 'object'
          ? {}
          : null;
      onChange([...arrayValue, defaultValue]);
    };

    const removeItem = (index: number) => {
      onChange(arrayValue.filter((_, i) => i !== index));
    };

    const updateItem = (index: number, itemValue: unknown) => {
      const newArray = [...arrayValue];
      newArray[index] = itemValue;
      onChange(newArray);
    };

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="block text-sm font-medium text-neutral-300">
            {name}
            {required && <span className="text-red-400 ml-1">*</span>}
            <span className="text-neutral-500 ml-2">({arrayValue.length} items)</span>
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={addItem}
            disabled={disabled}
            leftIcon={<Plus className="w-3 h-3" />}
          >
            Add
          </Button>
        </div>
        {property.description && (
          <p className="text-xs text-neutral-500">{property.description}</p>
        )}
        <div className="space-y-2 pl-4 border-l-2 border-neutral-800">
          <AnimatePresence>
            {arrayValue.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                className="flex items-start gap-2"
              >
                <div className="flex-1">
                  {property.items && (
                    <SchemaField
                      name={`[${index}]`}
                      property={property.items}
                      value={item}
                      onChange={(val) => updateItem(index, val)}
                      required={false}
                      disabled={disabled}
                      path={`${path}-${name}-${index}`}
                    />
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeItem(index)}
                  disabled={disabled}
                  className="mt-6"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </motion.div>
            ))}
          </AnimatePresence>
          {arrayValue.length === 0 && (
            <p className="text-xs text-neutral-600 italic py-2">
              No items. Click &quot;Add&quot; to add one.
            </p>
          )}
        </div>
      </div>
    );
  }

  // Object field
  if (property.type === 'object') {
    const objectValue = (value as Record<string, unknown>) || {};
    const properties = property.properties || {};
    const requiredFields = new Set(property.required || []);

    return (
      <div className="space-y-2">
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-2 text-sm font-medium text-neutral-300 hover:text-white transition-colors"
        >
          {isExpanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
          {name}
          {required && <span className="text-red-400 ml-1">*</span>}
        </button>
        {property.description && (
          <p className="text-xs text-neutral-500 ml-6">{property.description}</p>
        )}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pl-4 border-l-2 border-neutral-800"
            >
              {Object.entries(properties).map(([propName, propSchema]) => (
                <SchemaField
                  key={propName}
                  name={propName}
                  property={propSchema}
                  value={objectValue[propName]}
                  onChange={(val) => {
                    if (val === undefined) {
                      const { [propName]: _, ...rest } = objectValue;
                      onChange(rest);
                    } else {
                      onChange({ ...objectValue, [propName]: val });
                    }
                  }}
                  required={requiredFields.has(propName)}
                  disabled={disabled}
                  path={`${path}-${name}`}
                />
              ))}
              {Object.keys(properties).length === 0 && (
                <p className="text-xs text-neutral-600 italic py-2">
                  No properties defined for this object.
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  }

  // Unknown type
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-neutral-300">
        {name}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      {property.description && (
        <p className="text-xs text-neutral-500">{property.description}</p>
      )}
      <div className="flex items-center gap-2 text-xs text-yellow-400">
        <AlertCircle className="w-3 h-3" />
        Unknown type: {property.type}
      </div>
      <Input
        value={typeof value === 'string' ? value : JSON.stringify(value || '')}
        onChange={(e) => {
          try {
            onChange(JSON.parse(e.target.value));
          } catch {
            onChange(e.target.value);
          }
        }}
        disabled={disabled}
        placeholder={`Enter ${name}...`}
      />
    </div>
  );
}

/**
 * SchemaForm - Dynamic form generation from JSON Schema
 */
export default function SchemaForm({
  schema,
  value,
  onChange,
  disabled = false,
  className = '',
}: SchemaFormProps) {
  const properties = schema.properties || {};
  const requiredFields = useMemo(
    () => new Set(schema.required || []),
    [schema.required]
  );

  // Handle field change
  const handleFieldChange = useCallback(
    (fieldName: string, fieldValue: unknown) => {
      if (fieldValue === undefined) {
        const { [fieldName]: _, ...rest } = value;
        onChange(rest);
      } else {
        onChange({ ...value, [fieldName]: fieldValue });
      }
    },
    [value, onChange]
  );

  // Check if there are any fields
  if (Object.keys(properties).length === 0) {
    return (
      <div className={cn('text-sm text-neutral-500 italic py-4', className)}>
        This tool has no input parameters.
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {Object.entries(properties).map(([name, property]) => (
        <SchemaField
          key={name}
          name={name}
          property={property}
          value={value[name]}
          onChange={(val) => handleFieldChange(name, val)}
          required={requiredFields.has(name)}
          disabled={disabled}
          path="root"
        />
      ))}
    </div>
  );
}
