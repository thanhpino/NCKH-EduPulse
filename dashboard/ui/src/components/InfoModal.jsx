import React from 'react';

/**
 * InfoModal — Modal thông tin phần mềm & liên hệ hỗ trợ EduPulse
 */
export default function InfoModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
            <div className="bg-white rounded-lg shadow-2xl border border-gray-200 max-w-lg w-full overflow-hidden text-gray-800">
                {/* Header */}
                <div className="bg-[#005B7F] text-white px-5 py-3 flex items-center justify-between font-bold">
                    <div className="flex items-center space-x-2 text-sm">
                        <span className="bg-amber-400 text-blue-950 text-[10px] px-1.5 py-0.5 rounded font-black">INFO</span>
                        <span>THÔNG TIN PHẦN MỀM & LIÊN HỆ HỖ TRỢ</span>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-300 hover:text-white text-lg font-bold cursor-pointer transition-colors"
                    >
                        ✕
                    </button>
                </div>

                {/* Body Content */}
                <div className="p-5 space-y-4 text-xs">
                    {/* Software Overview */}
                    <div className="bg-sky-50 border-l-4 border-[#005B7F] p-3 rounded text-sky-900">
                        <h4 className="font-bold text-sm text-[#005B7F] mb-1">EduPulse Traffic Gateway System</h4>
                        <p className="leading-relaxed">
                            Hệ thống Cổng điều tiết tải Đăng ký Tín chỉ cho các bạn sinh viên</p>
                    </div>

                    {/* Team Members */}
                    <div>
                        <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-[#8C0000]"></span>
                            Đội Ngũ Phát Triển Dự Án (2 Members)
                        </h5>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-gray-50 border border-gray-200 p-3 rounded flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-full bg-[#005B7F] text-white font-bold text-xs flex items-center justify-center shadow">
                                    MT
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">Trương Minh Thành</div>
                                    <div className="text-[10px] text-gray-500 font-mono">System Architect & DevOps</div>
                                </div>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 p-3 rounded flex items-center space-x-3">
                                <div className="w-9 h-9 rounded-full bg-[#8C0000] text-white font-bold text-xs flex items-center justify-center shadow">
                                    TP
                                </div>
                                <div>
                                    <div className="font-bold text-gray-900">Huỳnh Trần Thiên Phú</div>
                                    <div className="text-[10px] text-gray-500 font-mono">Frontend & Backend</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Support & Contact */}
                    <div className="border-t border-gray-200 pt-3 space-y-2">
                        <h5 className="font-bold text-gray-900 text-xs uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            Liên Hệ & Hỗ Trợ Kỹ Thuật Đợt Đăng Ký
                        </h5>

                        <div className="bg-amber-50/60 border border-amber-200 p-2.5 rounded text-amber-900 space-y-1 font-mono text-[11px]">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Hotline Kỹ thuật:</span>
                                <span className="font-bold text-blue-900">0932013424 (TMT)</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Email Hỗ trợ:</span>
                                <span className="font-bold text-blue-900">tmt@edupulse.edu.vn</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Địa điểm hỗ trợ trực tiếp:</span>
                                <span className="font-bold text-gray-800">Phòng C.001 (Tòa C, CS Tân Phong)</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="bg-gray-100 px-5 py-2.5 flex justify-end border-t border-gray-200">
                    <button
                        onClick={onClose}
                        className="px-4 py-1.5 bg-gray-700 hover:bg-gray-800 text-white font-bold text-xs rounded shadow transition-all cursor-pointer"
                    >
                        Đóng
                    </button>
                </div>
            </div>
        </div>
    );
}
