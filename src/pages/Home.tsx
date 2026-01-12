import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Home = () => {
	return (
		<div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#0A5C3A]/10 via-white to-slate-50 px-4">
			<div className="w-full max-w-3xl rounded-3xl border border-slate-100 bg-white/90 p-10 text-center shadow-xl backdrop-blur">
				<p className="text-sm uppercase tracking-[0.3em] text-[#0A5C3A]">Logistics OS</p>
				<h1 className="mt-3 text-4xl font-semibold text-slate-900 sm:text-5xl">Maalbardaar</h1>
				<p className="mt-4 text-lg text-slate-600">
					Track and manage your shipments in a clean, map-aware dashboard.
				</p>
				<div className="mt-8 flex justify-center">
					<Button asChild className="bg-[#0A5C3A] px-6 text-white hover:bg-[#0a5c3a]/90">
						<Link to="/shipments">Go to Shipments</Link>
					</Button>
				</div>
			</div>
		</div>
	);
};
