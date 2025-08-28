
import Header from "./header";
import Footer from "./footer";

export default function Skeleton({ children }) {

    return(
        <div class="grid justify-center grid-rows-[auto_1fr_auto] h-screen w-screen grid-cols-1 overflow-x-hidden" >
            <Header />

            <main>
                {children}
            </main>
        
            <Footer />
        </div>
    )

}