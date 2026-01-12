import { useState, useEffect } from 'react';
import { DashboardMap } from '@/components/dashboard/DashboardMap';
import { Button } from '@/components/ui/button';

export function Dashboard() {
  return (
    <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 lg:px-8 bg-white">
      <div className="mb-6 -mx-4 -mt-6 px-4 py-8 lg:-mx-8 lg:px-8 rounded-b-2xl bg-gradient-to-r from-[#071724] via-[#0a5c3a] to-[#0a3b6b] text-white flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Fleet Pulse — Live Vessel Traffic</h1>
          <p className="mt-2 text-sm text-white/80">Live vessel positions and statuses on an immersive, interactive map</p>
        </div>
      </div>

      <div className="space-y-4">
        <DashboardMap />
      </div>
    </div>
  );
}

export default Dashboard;
