import React from 'react';
import type { User, Settings } from '../../types';
import { InputField } from './ProfileComponents';
import { AddressAutocomplete, AddressData } from '../AddressAutocomplete';

interface ProfileInfoTabProps {
    formData: User;
    handleInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    handleAddressChange: (address: AddressData) => void;
    settings: Settings;
    profilePicPreview: string;
    triggerMatrixSelector: () => void;
}

export const ProfileInfoTab: React.FC<ProfileInfoTabProps> = ({
    formData, handleInputChange, handleAddressChange, settings
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

                    <div>
                        <InputField label="Public Vanity Slug (e.g. eric-cornett)" id="publicSlug" name="publicSlug" value={formData.publicSlug || ''} onChange={handleInputChange} />
                        {formData.publicSlug && (
                            <div className="mt-2 text-right">
                                <a href={`/u/${formData.publicSlug}`} target="_blank" rel="noopener noreferrer" className="text-[10px] uppercase font-mono tracking-widest text-emerald-400 hover:text-emerald-300 transition-colors flex items-center justify-end gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                                    View Live Biodata Extract ({`/u/${formData.publicSlug}`})
                                </a>
                            </div>
                        )}
                    </div>

                    <InputField label="Primary Email Address" id="email" name="email" value={formData.email} onChange={handleInputChange} type="email" autoComplete="email" required />

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <InputField label="Direct Phone Number" id="phoneNumber" name="tel" value={formData.phoneNumber || ''} onChange={handleInputChange} type="tel" autoComplete="tel" placeholder="+1 (555) 000-0000" />
                        <InputField label="LifeOS Secure Email (@gigiwatt.com)" id="lifeOsEmail" name="lifeOsEmail" value={formData.lifeOsEmail || ''} onChange={handleInputChange} type="email" placeholder="vanity.slug@gigiwatt.com" />
                    </div>

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

                <AddressAutocomplete
                    onChange={handleAddressChange}
                    value={{
                        streetAddress: formData.address.street,
                        addressLocality: formData.address.city,
                        addressRegion: formData.address.state,
                        postalCode: formData.address.zip,
                        addressCountry: 'USA'
                    }}
                />

                <div className="mt-4">
                    <InputField
                        label="Address Line 2 (Apt, Suite)"
                        id="address.address2"
                        name="address-line2"
                        value={formData.address.address2 || ''}
                        onChange={handleInputChange}
                        autoComplete="address-line2"
                    />
                </div>
            </div>
        </div>
    );
};
