import { useContext } from "react";
import { WorkletContext, WorkletContextType } from "../contexts/WorkletContext";

export const useWorklet = (): WorkletContextType => {
  const context = useContext(WorkletContext);

  if (context === undefined) {
    throw new Error('useWorklet must be used within a WorkletProvider');
  }

  return context;
};

export default useWorklet;
