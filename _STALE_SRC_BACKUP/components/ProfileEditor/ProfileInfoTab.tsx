import React from 'react';
import type { User } from '@/types';
import { InputField } from './ProfileComponents';

interface ProfileInfoTabProps {
    formData: User;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    profilePicPreview: string; 
    triggerMatrixSelector: () => void;
}

export const ProfileInfoTab: React.FC<ProfileInfoTabProps> = ({ 
    formData, handleInputChange
}) => {
    return (
        <div className="space-y-8">
            {/* Identity Section */}
            <div>
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">
                    Core Identity
                </h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <InputField label="First Name" id="firstName" name="given-name" value={formData.firstName} onChange={handleInputChange} autoComplete="given-name" required />
                    <InputField label="Last Name" id="lastName" name="family-name" value={formData.lastName} onChange={handleInputChange} autoComplete="family-name" required />
                </div>
                
                <div className="space-y-6">
                    <InputField label="Display Name" id="displayName" name="nickname" value={formData.displayName} onChange={handleInputChange} autoComplete="nickname" required />
                    
                    <InputField label="Email Address" id="email" name="email" value={formData.email} onChange={handleInputChange} type="email" autoComplete="email" required />
                    
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Gender</label>
                        <select 
                            id="gender" 
                            value={formData.gender || 'Prefer not to say'} 
                            onChange={handleInputChange} 
                            // [ZEN MATCH] Exact hex #0f172a for select background
                            className="w-full bg-[#0f172a] border border-white/5 rounded-xl px-4 py-3 text-sm text-slate-200 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50 outline-none transition-all shadow-inner appearance-none cursor-pointer hover:bg-[#1e293b]"
                        >
                            <option>Prefer not to say</option>
                            <option>Male</option>
                            <option>Female</option>
                            <option>Non-binary</option>
                            <option>Other</option>
                        </select>
                    </div>
                </div>
            </div>
            
            {/* Location Section */}
            <div className="mt-8 pt-8">
                <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-6 border-b border-white/5 pb-2">
                    Primary Residence
                </h3>
                <div className="space-y-6">
                    <InputField label="Street Address" id="address.street" name="street-address" value={formData.address.street} onChange={handleInputChange} autoComplete="street-address" required />
                    <InputField label="Address Line 2 (Apt, Suite)" id="address.address2" name="address-line2" value={formData.address.address2 || ''} onChange={handleInputChange} autoComplete="address-line2" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <InputField label="City" id="address.city" name="address-level2" value={formData.address.city} onChange={handleInputChange} autoComplete="address-level2" required />
                        <InputField label="State / Province" id="address.state" name="address-level1" value={formData.address.state} onChange={handleInputChange} autoComplete="address-level1" required />
                        <InputField label="Zip / Postal Code" id="address.zip" name="postal-code" value={formData.address.zip} onChange={handleInputChange} autoComplete="postal-code" required pattern="\d{5}(-\d{4})?" />
                    </div>
                </div>
            </div>
        </div>
    );
};