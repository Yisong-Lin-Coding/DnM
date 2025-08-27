
import Header from "./header";
import Footer from "./footer";

export default function Skeleton({ children }) {

    return(
        <div class="grid justify-center grid-rows-[auto_1fr_auto] h-screen w-screen grid-cols-1" >
            <Header />

            <main className="flex-grow p-4">
                {children}
            </main>
        
            <Footer />
        </div>
    )

}