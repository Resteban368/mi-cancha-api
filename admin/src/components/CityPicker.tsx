import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import type { CityRef } from '../lib/types';
import { Field, Select } from './ui';

interface CatalogItem {
  id: string;
  name: string;
}

interface CityPickerProps {
  /** Ciudad elegida (id); '' si aún no hay. */
  cityId: string;
  /** Ciudad con la que se abre el selector, para mostrar su departamento. */
  initial?: CityRef | null;
  onChange: (cityId: string) => void;
}

/** Departamento y ciudad de Colombia (catálogo DANE): la ciudad depende del departamento. */
export function CityPicker({ cityId, initial, onChange }: CityPickerProps) {
  const [departments, setDepartments] = useState<CatalogItem[]>([]);
  const [cities, setCities] = useState<CatalogItem[]>([]);
  const [departmentId, setDepartmentId] = useState(initial?.department.id ?? '');
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api<CatalogItem[]>('/catalogs/departments').then(setDepartments, () => setFailed(true));
  }, []);

  useEffect(() => {
    if (!departmentId) {
      setCities([]);
      return;
    }
    let current = true;
    api<CatalogItem[]>(`/catalogs/departments/${departmentId}/cities`).then(
      (list) => current && setCities(list),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [departmentId]);

  return (
    <>
      <Field label="Departamento" error={failed ? 'No se pudo cargar la lista' : undefined}>
        {(id) => (
          <Select
            id={id}
            required
            value={departmentId}
            onChange={(e) => {
              setDepartmentId(e.target.value);
              onChange('');
            }}
          >
            <option value="">Selecciona…</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label="Ciudad">
        {(id) => (
          <Select
            id={id}
            required
            disabled={!departmentId}
            value={cityId}
            onChange={(e) => onChange(e.target.value)}
          >
            <option value="">{departmentId ? 'Selecciona…' : 'Elige primero el departamento'}</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </>
  );
}
