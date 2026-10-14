'use client';

import { useState, useEffect } from 'react';
import { db } from '@/services/firebase/config';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Settings, Shield, Check, Save, RefreshCw, Users, Lock } from 'lucide-react';

export default function SettingsPage() {
  const [roles, setRoles] = useState([
    { id: 'super_admin', name: 'Super Admin', permissions: { dashboard: true, inventory: true, stockOpname: true, masterData: true, scan: true } },
    { id: 'staff_gudang', name: 'Staff Gudang', permissions: { dashboard: true, inventory: true, stockOpname: true, masterData: false, scan: true } },
    { id: 'helper_gudang', name: 'Helper Gudang', permissions: { dashboard: true, inventory: true, stockOpname: true, masterData: false, scan: true } },
    { id: 'security', name: 'Security', permissions: { dashboard: true, inventory: false, stockOpname: true, masterData: false, scan: true } },
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const fetchRoles = async () => {
    try {
      setLoading(true);
      const docRef = doc(db, 'system', 'settings');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists() && docSnap.data().role_permissions) {
        setRoles(docSnap.data().role_permissions);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleTogglePermission = (roleId, permissionKey) => {
    setRoles(prev => prev.map(r => {
      if (r.id === roleId) {
        return {
          ...r,
          permissions: {
            ...r.permissions,
            [permissionKey]: !r.permissions[permissionKey]
          }
        };
      }
      return r;
    }));
  };

  const handleSaveRoles = async () => {
    try {
      setSaving(true);
      setMessage('');
      await setDoc(doc(db, 'system', 'settings'), {
        role_permissions: roles,
        updated_at: serverTimestamp()
      }, { merge: true });
      setMessage('Role permissions successfully saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to save role permissions.');
    } finally {
      setSaving(false);
    }
  };

  const permissionLabels = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'inventory', label: 'Stock & Items' },
    { key: 'stockOpname', label: 'Stock Opname' },
    { key: 'masterData', label: 'Master Data' },
    { key: 'scan', label: 'Scan In / Out' },
  ];

  return (
    <div className="w-full space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
            <Settings className="text-blue-600" size={24} /> Super Admin Settings & Role Permissions
          </h1>
          <p className="text-xs text-stone-500 mt-0.5">Configure user roles and view access permissions across warehouse modules.</p>
        </div>

        <button
          onClick={handleSaveRoles}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-5 py-2.5 rounded-xl text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
        >
          <Save size={16} /> {saving ? 'Saving...' : 'Save Permissions'}
        </button>
      </div>

      {message && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <Check size={16} className="text-emerald-600 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Hardware & RFID Input Configuration Card */}
      <div className="bg-white rounded-2xl border border-stone-200/80 p-6 shadow-2xs space-y-4">
        <div>
          <h3 className="text-sm font-bold text-stone-900">Hardware & RFID Input Mode Configuration</h3>
          <p className="text-xs text-stone-500 mt-0.5">Choose how RFID card scans are received on this warehouse workstation.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
            <div className="font-bold text-blue-600 flex items-center gap-1.5">
              <span>🔌 1. Web Serial USB (Direct)</span>
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Connects Google Chrome / Edge directly to USB COM port. Zero bridge required, 1ms instant response.
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
            <div className="font-bold text-blue-600 flex items-center gap-1.5">
              <span>🖥️ 2. USB Bridge (bridge.js)</span>
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Connects to local Node.js bridge script via local socket (localhost:8080).
            </p>
          </div>

          <div className="p-4 rounded-xl border border-stone-200 bg-stone-50 space-y-2">
            <div className="font-bold text-blue-600 flex items-center gap-1.5">
              <span>📡 3. Wi-Fi Cloud (ESP32)</span>
            </div>
            <p className="text-stone-600 text-[11px] leading-relaxed">
              Receives scans wirelessly over Wi-Fi network from standalone ESP32 readers via Firebase Cloud.
            </p>
          </div>
        </div>
      </div>

      {/* Role Permissions Matrix */}
      <div className="bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">Role Access Control Matrix</h3>
            <p className="text-xs text-stone-500">Check or uncheck the modules each role is allowed to view and access.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-600 border border-blue-200">
            <Shield size={13} /> RBAC Ready
          </span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-xs text-stone-400">Loading role settings...</div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead className="bg-stone-50 border-b border-stone-100 text-[11px] font-bold text-stone-500 uppercase tracking-wider">
                <tr>
                  <th className="p-4">User Role</th>
                  {permissionLabels.map(p => (
                    <th key={p.key} className="p-4 text-center">{p.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 text-xs text-stone-800">
                {roles.map(role => (
                  <tr key={role.id} className="hover:bg-stone-50/50 transition">
                    <td className="p-4 font-bold text-stone-900 flex items-center gap-2">
                      <Users size={15} className="text-blue-600" />
                      <div>
                        <p>{role.name}</p>
                        <span className="text-[10px] text-stone-400 font-mono">ID: {role.id}</span>
                      </div>
                    </td>
                    {permissionLabels.map(p => {
                      const hasAccess = role.permissions[p.key];
                      const isSuperAdmin = role.id === 'super_admin' && p.key === 'masterData';
                      return (
                        <td key={p.key} className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => !isSuperAdmin && handleTogglePermission(role.id, p.key)}
                            disabled={isSuperAdmin}
                            className={`w-8 h-8 rounded-xl inline-flex items-center justify-center transition cursor-pointer ${
                              hasAccess
                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                : 'bg-stone-100 text-stone-400 border border-stone-200'
                            } ${isSuperAdmin ? 'opacity-80 cursor-not-allowed' : ''}`}
                            title={isSuperAdmin ? 'Super Admin always has access' : 'Toggle access'}
                          >
                            {hasAccess ? <Check size={16} /> : <Lock size={14} />}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
